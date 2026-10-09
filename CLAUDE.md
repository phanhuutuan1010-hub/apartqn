@AGENTS.md

## Deploy verification rules

- Never write polling/wait loops (for/while + sleep) for deploys or anything else.
- After git push: tell the user "Pushed, waiting for deploy" and stop; the user confirms when Vercel is Ready. Or run ONE single check with `curl -m 10`.
- Every network command must have a timeout; split checks into separate short commands.
- If any command runs > 2 minutes, stop it and report instead of waiting.
