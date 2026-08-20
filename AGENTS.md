# Repository Guidelines

## Project and Priorities

WebTomorrowland is a public, informational, generic website for viewing and comparing purchase alternatives for Tomorrowland Brasil 2027. Deliver a production MVP quickly, then evolve it incrementally. Prioritize, in order: development speed, functionality, simplicity, componentization, maintainability, and visual design. Avoid overengineering, premature abstractions, and unrequested future features. When two approaches are valid, choose the simplest one that ships sooner without causing an obvious near-term rewrite.

## Required Stack

Use React, TypeScript, Vite, Firebase, Firestore, Firebase Hosting, and GitHub Actions. Do not add technologies or major dependencies without clear justification. The initial UI must be clean, responsive, and usable; visual perfection is not an MVP requirement.

## Structure and Architecture

Keep the React architecture lightweight and componentized. As the scaffold grows, organize code into `src/pages`, reusable `src/components`, optional `src/features`, `src/models` or `src/types`, `src/hooks`, `src/data`, `src/utils`, and styles. Place static assets in `public/` or `src/assets/`, and tests beside the subject or under `tests/`. Document new top-level directories in `README.md`.

Pages compose the UI. Keep components focused; split oversized components and never duplicate components or logic between one- and two-person plans. Components must not access Firestore or depend directly on the Firebase SDK. Isolate data access behind a small repository/service interface shared by Firestore and local/demo implementations. Do not introduce Redux or complex global state unless a demonstrated future need justifies it.

## Domain Rules

The application must remain completely generic. Never include real people's names, personal relationships, or real group compositions in code, demo data, UI, tests, or documentation.

Initial plan modes are `Plan 1 persona` and `Plan 2 personas`. Both must use the same domain model and differ only by traveler count.

A plan is invalid if it requires travelers to bring their own tent or camping equipment from Chile. Only allow lodging where Tomorrowland or the purchased package provides the required infrastructure and equipment. Enforce this as a domain/data validation rule, not merely by hiding options in the UI.

## Content, Pricing, and Sources

Every price must be classified as `ESTIMATED` or `OFFICIAL`; never present an estimate as official. Preserve provenance when available: source URL, source type, verification date, and update date. Official sources take priority over estimates.

Design data models so a later, independent automation can query official sources, detect changes, normalize content, and update Firestore without redeploying the website. Do not build that automation unless explicitly requested.

## Firestore and Security

Firestore is the production content source, and the public application is read-only. Do not implement login, user authentication, an admin panel, public CRUD, or user management. Development must support local/demo data through the same interfaces and domain models used by Firestore.

Keep deployment flows separate:

- Code: GitHub -> GitHub Actions -> Firebase Hosting.
- Content: source/automation -> Firestore -> website.

Never commit private credentials, service accounts, secrets, or private API keys. Use environment variables and GitHub Secrets as appropriate. Commit safe public Firebase configuration only when intentionally required by the client application.

## Commands and Quality Gates

The repository currently has no configured build or test toolchain. Once introduced, expose predictable scripts such as `npm run dev`, `npm run build`, `npm test`, and `npm run lint`, document setup in `README.md`, and commit the lockfile.

Before declaring implementation work complete, run every available relevant validation. TypeScript must have no errors, lint must be clean, relevant tests must pass, and the production build must succeed. Never suppress TypeScript errors merely to obtain a successful build. Fix bugs at their root cause when reasonable, and add regression tests for bug fixes once a test runner exists.

## Coding and Testing Conventions

Follow committed formatter and linter settings. Until configured, use two-space indentation, UTF-8, and final newlines. Use `PascalCase` for React components and classes, `camelCase` for variables and functions, and `kebab-case` for asset filenames. Prefer descriptive names and small, focused modules.

Name tests after the subject and behavior, for example `Header.test.tsx` or `navigation.spec.ts`. New features should include relevant tests once testing infrastructure exists. Do not invent a coverage threshold until the project defines one.

## Git and Pull Requests

Before changing code, inspect repository status, preserve existing work, and avoid destructive operations. Never automatically run `git push`, force-push, destructive reset, branch deletion, or similar irreversible actions. The user decides when to publish remote changes unless explicitly instructing otherwise.

Use small commits representing functional milestones when reasonable, with concise imperative subjects such as `Add plan comparison model`. Pull requests should explain purpose and approach, link relevant issues, list validations, and include screenshots or recordings for visible UI changes. Call out configuration changes, dependencies, limitations, and follow-up work.

## Agent Workflow

For minor technical choices, proceed autonomously without asking about trivial preferences. For each task: inspect, plan briefly, implement only the requested scope, run validations, review the change, fix discovered issues, and report the outcome. Ask only when a genuinely ambiguous product decision, destructive risk, or unavailable credential/permission blocks safe progress.

Final reports must state what changed, validations executed and their results, relevant debt or limitations, and the recommended next step.
