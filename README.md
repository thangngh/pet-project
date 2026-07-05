# Pet E-commerce

DDD + Hexagonal Architecture (Ports & Adapters) — Monolithic NestJS 10 API

## Structure

```
├── backend/         # Source code (see backend/README.md)
│   ├── src/         # Application code
│   ├── test/        # E2E tests
│   ├── package.json
│   └── ...
├── docs/            # Design specs, ADRs, gates, strategies
├── CLAUDE.md        # AI coding agent instructions
└── LICENSE          # License terms
```

## License

**Commercial use** requires a paid license.
**Module use** requires public fork of modified source.

See [LICENSE](./LICENSE) for full terms.

## Quick Start

```bash
cd backend
cp .env.example .env
pnpm install
pnpm start:dev
```
