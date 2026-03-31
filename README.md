# XEROVAA

A dark-themed graph-based OSINT mapping tool built with Win32 + WebView2.
Designed for visualizing and documenting relationships between digital identities, accounts, contacts, and metadata.

---

## What it does

XEROVAA lets you create node cards representing different types of digital artifacts — users, emails, social accounts, phone numbers, websites, and notes — and visually connect them into a relationship graph. The result can be exported as a standalone HTML report.

---

## Features

- **Node types** — User, Email, Social, Phone, Website, Other
- **Visual graph** — drag nodes freely, connect them with curved animated edges
- **Color labels** — mark nodes as Critical, Important, Note, Safe, Info, Target
- **Connect mode** — click two nodes to link them
- **Delete edge** — right-click any connection line to remove it
- **Node isolation** — double-click a node to dim everything unrelated
- **Connected highlight** — selecting a node highlights all its direct connections
- **Auto layout** — force-directed algorithm arranges nodes automatically
- **Undo** — Ctrl+Z steps back through the last 40 actions
- **Rain toggle** — ambient rain animation, can be disabled
- **Theme switcher** — Dark / Light color scheme
- **Save JSON** — exports full graph state as a project file
- **Load JSON** — restores a previously saved project
- **Export HTML** — generates a self-contained OSINT report with hover effects, animated edges, and optional rain

---

## Project structure
