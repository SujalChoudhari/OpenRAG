# Implementation Plan: OpenRAG "Second Brain" Edition

This plan transforms OpenRAG into a personal intelligence layer ("Second Brain") that integrates deeply with an Obsidian Vault.

## 1. Core Philosophy & Architecture
- **Goal**: "Second Brain" / "Life Memory Index". No impersonation, just deep retrieval and analysis.
- **Data Source**: Local Obsidian Vault (`F:\Workspace\ObsidianVault\Sujal`).
- **Storage**: **LanceDB** (Embedded, High-Performance Vector Search).
- **Structure**: "One file per person" with "NavDown" syntax (Assumed hierarchical linking).

## 2. Backend Overhaul (LanceDB Migration)
- **Action Items**:
    - [x] Install `@lancedb/lancedb` and `@lancedb/vectordb`.
    - [ ] Create `src/lib/lancedb.ts` to manage the DB connection.
    - [ ] Refactor `src/lib/vector-store.ts` to use LanceDB.
        - **Schema**: `id`, `text`, `vector`, `metadata` (filename, type, tags, persons referenced).
    - [ ] Implement `ingestVault(path)` function:
        - Recursive file scanning.
        - **"NavDown" Parsing**: specialized parser to handle the user's navigational syntax (TBD: defaulting to identifying `[[Link]]` structures for now).
        - **Person-Centric Chunking**: Keep "Person" files relatively intact or chunk by logical headers (e.g., `# Timeline`, `# Relations`).
    - [ ] **Background Worker**: Ensure ingestion happens off the main thread to keep UI smooth.

## 3. UI/UX: "GoTo UI" & Configuration
- **Action Items**:
    - [ ] **Settings Page**:
        - **Vault Location**: Input for `F:\Workspace\ObsidianVault\Sujal`.
        - **Model Config**: LISAM / LLM selection.
        - **Re-Index Button**: Trigger full vault scan.
    - [ ] **Chat Interface**:
        - "Analyst" Persona: System prompt should focus on *synthesizing* facts, not assuming identity.
        - **Citations**: High priority. Every answer must cite the specific Obsidian note.
        - **Visual Polish**: Glassmorphism, framer-motion animations.

## 4. Execution Steps
1.  **Dependencies**: (Done).
2.  **Refactor Vector Store**: Switch to LanceDB.
3.  **Settings UI**: Build the configuration screen.
4.  **Ingestion Logic**: Implement the watcher and parser.
5.  **Validation**: Test with a dummy "Person" note to verify retrieval.

## 5. "NavDown" Syntax Strategy
Since "NavDown" is unique to the user, we will implement a `NavDownParser` class.
- *Initial Search*: Look for `[[Link]]` lists at the bottom of files or specific `nav_down` properties in frontmatter.
- *Refinement*: We will add logging to show what links are extracted, allowing the user to debug if the app is "reading" the structure correctly.
