//
//  Your_voiceApp.swift
//  Your voice
//
//  Created by Sundari on 6/13/26.
//

import SwiftUI
import SwiftData

@main
struct Your_voiceApp: App {
    var sharedModelContainer: ModelContainer = {
        let schema = Schema([
            Item.self,
        ])
        let modelConfiguration = ModelConfiguration(schema: schema, isStoredInMemoryOnly: false)

        do {
            return try ModelContainer(for: schema, configurations: [modelConfiguration])
        } catch {
            // Retry with an in-memory store rather than crashing — data may be lost
            // but the app remains functional. This can happen after schema migrations.
            let fallbackConfig = ModelConfiguration(schema: schema, isStoredInMemoryOnly: true)
            return (try? ModelContainer(for: schema, configurations: [fallbackConfig]))
                ?? { fatalError("Could not create ModelContainer: \(error)") }()
        }
    }()

    var body: some Scene {
        WindowGroup {
            ContentView()
        }
        .modelContainer(sharedModelContainer)
    }
}
