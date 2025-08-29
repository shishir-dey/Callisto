//! Schema generation binary
//! 
//! This binary generates JSON schemas for the WebSocket protocol messages
//! and writes them to the schema/ws/ directory for use by the client.

use callisto_protocol::{ClientMessage, ServerMessage};
use schemars::schema_for;
use std::fs;
use std::path::Path;

/// Prefixes all definition keys in a schema with the given prefix
fn prefix_definitions(schema: &mut serde_json::Value, prefix: &str) {
    if let Some(definitions) = schema.get_mut("definitions").and_then(|d| d.as_object_mut()) {
        // Collect the original keys to avoid borrowing issues
        let original_keys: Vec<String> = definitions.keys().cloned().collect();
        
        // Create new entries with prefixed keys
        for key in original_keys {
            if let Some(value) = definitions.remove(&key) {
                let prefixed_key = format!("{}_{}", prefix, key);
                definitions.insert(prefixed_key, value);
            }
        }
    }
}

/// Updates all references in a schema to use the prefixed definition names
fn update_references(value: &mut serde_json::Value, prefix: &str) {
    match value {
        serde_json::Value::Object(obj) => {
            for (_, v) in obj.iter_mut() {
                update_references(v, prefix);
            }
        }
        serde_json::Value::Array(arr) => {
            for item in arr.iter_mut() {
                update_references(item, prefix);
            }
        }
        serde_json::Value::String(s) => {
            if let Some(def_name) = s.strip_prefix("#/definitions/") {
                *s = format!("#/definitions/{}_{}", prefix, def_name);
            }
        }
        _ => {}
    }
}

/// Processes a schema by adding prefixes to definitions and updating references
fn process_schema(mut schema: serde_json::Value, prefix: &str) -> serde_json::Value {
    // First, update all internal references to use the new prefixed names
    update_references(&mut schema, prefix);
    
    // Then, prefix the definition keys themselves
    prefix_definitions(&mut schema, prefix);
    
    // Update the root $ref if it exists
    if let Some(root_ref) = schema.get("$ref").and_then(|r| r.as_str()) {
        if let Some(def_name) = root_ref.strip_prefix("#/definitions/") {
            *schema.get_mut("$ref").unwrap() = 
                serde_json::Value::String(format!("#/definitions/{}_{}", prefix, def_name));
        }
    }
    
    schema
}

/// Extracts definitions from a schema, removing the "definitions" key
fn extract_definitions(schema: &serde_json::Value) -> Option<serde_json::Map<String, serde_json::Value>> {
    schema.get("definitions")
        .and_then(|d| d.as_object())
        .cloned()
}

/// Creates a root schema object without the definitions
fn create_root_schema(mut schema: serde_json::Value, schema_name: &str) -> serde_json::Value {
    // Remove definitions from the root schema since we'll put them in the combined definitions
    if let Some(obj) = schema.as_object_mut() {
        obj.remove("definitions");
    }
    
    // If this schema has a $ref pointing to its own definitions, update it
    if let Some(root_ref) = schema.get("$ref").and_then(|r| r.as_str()) {
        if root_ref.starts_with("#/definitions/") {
            // Keep the reference as-is since we've already prefixed it
            schema
        } else {
            schema
        }
    } else {
        // If there's no $ref, this IS the root schema definition
        schema
    }
}

fn main() -> Result<(), Box<dyn std::error::Error>> {
    println!("Generating JSON schemas for Callisto protocol...");

    // Create schema directory if it doesn't exist
    let schema_dir = Path::new("../../schema/ws");
    fs::create_dir_all(schema_dir)?;

    // Generate individual schemas
    let server_schema = schema_for!(ServerMessage);
    let client_schema = schema_for!(ClientMessage);

    // Write individual schema files
    let server_json = serde_json::to_string_pretty(&server_schema)?;
    fs::write(schema_dir.join("server-message.json"), server_json)?;
    println!("Generated server-message.json");

    let client_json = serde_json::to_string_pretty(&client_schema)?;
    fs::write(schema_dir.join("client-message.json"), client_json)?;
    println!("Generated client-message.json");

    // Generate combined schema
    let client_json_value = serde_json::to_value(&client_schema)?;
    let server_json_value = serde_json::to_value(&server_schema)?;

    // Process schemas with prefixes
    let processed_client = process_schema(client_json_value.clone(), "ClientMessage");
    let processed_server = process_schema(server_json_value.clone(), "ServerMessage");

    // Build combined definitions
    let mut combined_definitions = serde_json::Map::new();

    // Add ClientMessage definitions
    if let Some(client_defs) = extract_definitions(&processed_client) {
        combined_definitions.extend(client_defs);
    }
    
    // Add ServerMessage definitions  
    if let Some(server_defs) = extract_definitions(&processed_server) {
        combined_definitions.extend(server_defs);
    }

    // Add the root message schemas
    combined_definitions.insert(
        "ClientMessage".to_string(), 
        create_root_schema(processed_client, "ClientMessage")
    );
    combined_definitions.insert(
        "ServerMessage".to_string(), 
        create_root_schema(processed_server, "ServerMessage")
    );

    // Create the combined schema
    let combined = serde_json::json!({
        "$schema": "http://json-schema.org/draft-07/schema#",
        "title": "Callisto WebSocket Protocol",
        "description": "Message schemas for the Callisto ITM viewer WebSocket protocol",
        "definitions": combined_definitions
    });

    let combined_json = serde_json::to_string_pretty(&combined)?;
    fs::write(schema_dir.join("protocol.json"), combined_json)?;
    println!("Generated protocol.json");

    println!("Schema generation complete!");
    Ok(())
}