# Oliwood Portfolio

Static portfolio site deployed to Netlify:

https://oliwood-portfolio.netlify.app

## Local QA

```bash
npm test
```

Checks:

- missing local assets
- local links that escape the project root
- secret-looking token patterns
- long literal password/copy strings as warnings

External link checks:

```bash
npm run test:links
```

## Deploy

```bash
npm run deploy
```

Netlify site:

- Site name: `oliwood-portfolio`
- Site ID: `ae341b5e-3563-442b-b7bf-f17e2e85d730`

