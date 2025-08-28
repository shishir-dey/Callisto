//! Callisto CLI - ITM Viewer Server
//! 
//! This binary provides a WebSocket server for the Callisto ITM viewer.

use axum::{
    extract::{
        ws::{Message, WebSocket, WebSocketUpgrade},
        State,
    },
    http::StatusCode,
    response::Response,
    routing::get,
    Router,
};
use futures_util::{SinkExt, StreamExt};
use callisto_core::{ItmSession, MockDataGenerator};
use callisto_protocol::{ClientMessage, ServerMessage};
use chrono::Utc;
use clap::Parser;
use std::sync::Arc;
use tokio::sync::{mpsc, Mutex};
use tower_http::cors::CorsLayer;
use tracing::{debug, error, info, warn};
use uuid::Uuid;

#[derive(Parser)]
#[command(name = "callisto")]
#[command(about = "Callisto ITM Viewer Server")]
struct Args {
    /// List available probes
    #[arg(long)]
    list_probes: bool,

    /// Authorization token
    #[arg(long)]
    token: Option<String>,

    /// ITM baud rate
    #[arg(long, default_value = "2000000")]
    baud: u32,

    /// Target chip
    #[arg(long)]
    chip: Option<String>,

    /// Server port
    #[arg(long, default_value = "9229")]
    port: u16,

    /// Enable mock data generation
    #[arg(long)]
    mock: bool,
}

#[derive(Clone)]
struct AppState {
    server_id: Uuid,
    token: Option<String>,
    mock_mode: bool,
}

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    // Initialize tracing
    tracing_subscriber::fmt()
        .with_env_filter(tracing_subscriber::EnvFilter::from_default_env())
        .init();

    let args = Args::parse();

    if args.list_probes {
        list_probes().await?;
        return Ok(());
    }

    let state = AppState {
        server_id: Uuid::new_v4(),
        token: args.token,
        mock_mode: args.mock,
    };

    info!("Starting Callisto server on port {}", args.port);
    info!("Server ID: {}", state.server_id);
    if args.mock {
        info!("Mock mode enabled");
    }

    let app = Router::new()
        .route("/ws", get(websocket_handler))
        .layer(CorsLayer::permissive())
        .with_state(state);

    let listener = tokio::net::TcpListener::bind(format!("127.0.0.1:{}", args.port)).await?;
    info!("Server listening on http://127.0.0.1:{}/ws", args.port);

    axum::serve(listener, app).await?;

    Ok(())
}

async fn list_probes() -> anyhow::Result<()> {
    info!("Listing available probes...");
    
    let probes = callisto_core::ProbeManager::list_probes().await?;
    
    if probes.is_empty() {
        println!("No probes found");
    } else {
        println!("Available probes:");
        for probe in probes {
            println!("  {} (VID:{:04X} PID:{:04X})", 
                probe.identifier, probe.vendor_id, probe.product_id);
            if let Some(serial) = probe.serial_number {
                println!("    Serial: {}", serial);
            }
        }
    }
    
    Ok(())
}

async fn websocket_handler(
    ws: WebSocketUpgrade,
    State(state): State<AppState>,
) -> Response {
    ws.on_upgrade(|socket| handle_websocket(socket, state))
}

async fn handle_websocket(socket: WebSocket, state: AppState) {
    info!("New WebSocket connection established");

    let (sender, mut receiver) = socket.split();
    let (tx, mut rx) = mpsc::unbounded_channel::<ServerMessage>();

    // Send hello message
    let hello = ServerMessage::Hello {
        version: "0.1.0".to_string(),
        server_id: state.server_id,
        timestamp: Utc::now(),
    };
    
    if tx.send(hello).is_err() {
        error!("Failed to send hello message");
        return;
    }

    // Create ITM session
    let session = Arc::new(Mutex::new(ItmSession::new(tx.clone())));

    // Start mock data generator if enabled
    let _mock_handle = if state.mock_mode {
        let mut mock_gen = MockDataGenerator::new(tx.clone());
        Some(tokio::spawn(async move {
            mock_gen.start().await;
        }))
    } else {
        None
    };

    // Spawn task to send messages to client
    let sender_task = {
        let sender = Arc::new(Mutex::new(sender));
        tokio::spawn(async move {
            while let Some(msg) = rx.recv().await {
                let json = match serde_json::to_string(&msg) {
                    Ok(json) => json,
                    Err(e) => {
                        error!("Failed to serialize message: {}", e);
                        continue;
                    }
                };

                let mut sender_guard = sender.lock().await;
                if sender_guard.send(Message::Text(json)).await.is_err() {
                    debug!("Client disconnected");
                    break;
                }
            }
        })
    };

    // Handle incoming messages from client
    while let Some(msg) = receiver.next().await {
        match msg {
            Ok(Message::Text(text)) => {
                match serde_json::from_str::<ClientMessage>(&text) {
                    Ok(client_msg) => {
                        if let Err(e) = handle_client_message(client_msg, &session, &tx).await {
                            error!("Error handling client message: {}", e);
                        }
                    }
                    Err(e) => {
                        warn!("Failed to parse client message: {}", e);
                    }
                }
            }
            Ok(Message::Close(_)) => {
                info!("Client closed connection");
                break;
            }
            Err(e) => {
                error!("WebSocket error: {}", e);
                break;
            }
            _ => {}
        }
    }

    sender_task.abort();
    info!("WebSocket connection closed");
}

async fn handle_client_message(
    msg: ClientMessage,
    session: &Arc<Mutex<ItmSession>>,
    tx: &mpsc::UnboundedSender<ServerMessage>,
) -> anyhow::Result<()> {
    match msg {
        ClientMessage::Connect { probe_selector, chip, token: _ } => {
            info!("Client requesting connection to probe: {:?}, chip: {:?}", probe_selector, chip);
            
            let status = ServerMessage::Status {
                connected: true,
                target: Some("Mock Target".to_string()),
                chip: chip.clone(),
                probe: probe_selector,
            };
            tx.send(status)?;
        }
        
        ClientMessage::Start { allow_mask, baud_rate } => {
            info!("Starting ITM tracing with mask: 0x{:08x}, baud: {:?}", allow_mask, baud_rate);
            
            let mut session_guard = session.lock().await;
            session_guard.start_tracing(allow_mask, baud_rate).await?;
            
            // Send meta information
            let meta = ServerMessage::Meta {
                ports_map: callisto_protocol::standard_ports::default_config(),
                cpu_hz: Some(168_000_000), // Mock 168MHz
                dwt_available: true,
            };
            tx.send(meta)?;
        }
        
        ClientMessage::Stop => {
            info!("Stopping ITM tracing");
            
            let mut session_guard = session.lock().await;
            session_guard.stop_tracing().await?;
            
            let status = ServerMessage::Status {
                connected: false,
                target: None,
                chip: None,
                probe: None,
            };
            tx.send(status)?;
        }
        
        ClientMessage::SetFilter { port_mask, event_types } => {
            debug!("Setting filter - port_mask: {:?}, event_types: {:?}", port_mask, event_types);
            // TODO: Implement filtering
        }
    }
    
    Ok(())
}