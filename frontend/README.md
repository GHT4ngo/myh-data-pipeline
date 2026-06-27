# MYH Data Pipeline Dashboard

Frontend dashboard for the MYH Data Pipeline project.

The dashboard presents the curated MYH application data from 2018-2025 and calls the deployed FastAPI directly.

**Data shown:** 9,983 applications  
**API:** `https://de25-hemtenta-christofer.onrender.com`  
**Backend source:** <https://github.com/GHT4ngo/myh-data-pipeline>

## What The Frontend Shows

- Project overview and pipeline story
- Live dashboard charts from FastAPI statistics endpoints
- Yearly volume and approval-rate trends
- Decision comparison by year
- County, education-area, study-form, and provider comparisons
- Separate explanation for `Flera kommuner`, because it is a source marker and not a county
- Data explorer with filters, pagination, provider contains-search, and CSV export
- API reference and backend source snippets
- Tools/stack section including development assistants and frontend tooling

## Tools And Roles

| Tool | Where | Role |
| --- | --- | --- |
| Lovable | Frontend | Initial frontend/dashboard project and deployment workflow |
| React 19 | Frontend | UI framework |
| TanStack Query | Frontend | Live API data fetching and cache state |
| Recharts | Frontend | Dashboard charts |
| Tailwind CSS | Frontend | Styling system |
| FastAPI | Backend/API | Data service consumed by the dashboard |
| PostgreSQL/Neon | Backend/Cloud DB | Stores the curated data |
| Render | Backend hosting | Hosts the deployed API |
| Claude Code | Assistant | Code assistant and project assistant during development |
| Codex | Assistant | Project review, dashboard/API polish, and final release preparation |

## Local Development

```bash
npm install
npm run dev
```

## Checks

```bash
npm run build
npm run lint
```

## Notes

This repo is separate from the backend repo. Lovable deploys from this frontend repository after changes are pushed.
