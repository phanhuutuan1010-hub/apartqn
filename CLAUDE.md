@AGENTS.md

## Deploy verification rules

- Never write polling/wait loops (for/while + sleep) for deploys or anything else.
- After git push: tell the user "Pushed, waiting for deploy" and stop; the user confirms when Vercel is Ready. Or run ONE single check with `curl -m 10`.
- Every network command must have a timeout; split checks into separate short commands.
- Production is https://apartqn.com (www and apartqn.vercel.app redirect to it): run verification curls against that URL.
- If any command runs > 2 minutes, stop it and report instead of waiting.

## Pasted briefs

- When I paste a brief/prompt, treat it as a task to execute end-to-end.
- Additive migrations may be applied to production without asking. Ask first only for destructive migrations (drop/delete/rename columns or data).

## Rental term

- Thuê dài hạn từ 1 tháng / long-term rentals from 1 month / долгосрочная аренда от 1 месяца (`lib/term.ts`, `min_term` default 1). Under every "Từ {price}": "Giá có thể thay đổi theo thời hạn thuê".
