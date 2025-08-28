//! Schema generation binary
//! 
//! This binary generates JSON schemas for the WebSocket protocol messages
//! and writes them to the schema/ws/ directory for use by the client.

use callisto_protocol::{ClientMessage, ServerMessage};
use schemars::schema_for;
use std::fs;
use std::path::Path;

fn main() -> Result<(), Box<dyn std::error::Error>> {
    println!("Generating JSON schemas for Callisto protocol...");

    // Create schema directory if it doesn't exist
    let schema_dir = Path::new("../../schema/ws");
    fs::create_dir_all(schema_dir)?;

    // Generate schema for ServerMessage
    let server_schema = schema_for!(ServerMessage);
    let server_json = serde_json::to_string_pretty(&server_schema)?;
    fs::write(schema_dir.join("server-message.json"), server_json)?;
    println!("Generated server-message.json");

    // Generate schema for ClientMessage
    let client_schema = schema_for!(ClientMessage);
    let client_json = serde_json::to_string_pretty(&client_schema)?;
    fs::write(schema_dir.join("client-message.json"), client_json)?;
    println!("Generated client-message.json");

    // Generate a combined schema file for convenience
    let combined = serde_json::json!({
        "$schema": "http://json-schema.org/draft-07/schema#",
        "title": "Callisto WebSocket Protocol",
        "description": "Message schemas for the Callisto ITM viewer WebSocket protocol",
        "definitions": {
            "ServerMessage": server_schema,
            "ClientMessage": client_schema
        }
    });
    let combined_json = serde_json::to_string_pretty(&combined)?;
    fs::write(schema_dir.join("protocol.json"), combined_json)?;
    println!("Generated protocol.json");

    println!("Schema generation complete!");
    Ok(())
}