# Memory: index.md
Updated: 2026-03-22

# Eternia Project Memory

## Project Overview
- **Type**: Institutional Student Wellbeing Platform
- **Design**: Dark + calming theme with teal/lavender accents
- **Fonts**: Space Grotesk (headings), Inter (body)

## Design System Tokens
- Primary: Teal (174 62% 47%)
- Secondary/Accent: Lavender (262 52% 60%)
- Background: Dark blue (222 47% 6%)
- Success: Green, Warning: Amber, Destructive: Red

## AI Integration
- **Groq AI** used for all AI moderation/transcription (GROQ_API_KEY secret)
- Model: openai/gpt-oss-20b (GPT OSS 20B 128k)
- Edge functions: ai-moderate (BlackBox entries), ai-transcribe (voice keyword detection)
- L1/L2/L3 escalation levels with trigger snippets

## Auth
- Username-based login via @eternia.local emails
- Auto-confirm enabled (no email verification)
- Profile auto-created on signup via trigger
- 100 ECC welcome bonus on signup
- Student IDs auto-generated: ETN-{INST}-{SEQ}

## User Roles (RBAC)
- Student, Intern, Expert, SPOC, Admin, Therapist
- Credits system: student-only (role-gated)
- Recovery hints: predefined dropdown questions (not free text)

## BlackBox
- Strictly audio-only (audioOnly prop throughout VideoSDK tree)
- No webcam toggle, no video rendering
