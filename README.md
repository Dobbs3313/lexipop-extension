# LexiPop

> **Privacy-First Double-Click Dictionary, Audio & Wordbook**

A fast, privacy-first Chrome Manifest V3 extension built by **ARIS PARTY LLC** to outperform **Google Dictionary** (`mgijmajocgfcbeboacabfgobmjgjcoja`, 4M+ users, 3.8★).

## Competitive Advantages
- Replaces Google Dictionary (4M users, 3.8★) with ZERO Google Analytics and minimal permissions
- Fixes tiny unreadable popup font with live font-size slider & Dark/Light bubble mode
- Shows multiple definitions, examples, synonyms, and audio pronunciation instead of terse single lines
- Includes built-in Wordbook + Anki/CSV export for language learners

## Free vs LexiPop Pro
### Free
- Instant double-click or Alt+Click word definition bubble on any webpage
- Phonetic IPA pronunciation + 1-click native audio playback
- Multiple parts of speech, full definitions, real usage examples & synonyms
- Adjustable bubble font size (12px–20px) and Dark/Light bubble theme
- Recent 25 lookup history with instant toolbar search

### Pro (Monetized via Stripe)
- Unlimited saved Wordbook & study flashcards
- 1-click export to Anki TSV, CSV, and JSON
- Custom lookup trigger & accent styling
- Offline cache of looked-up definitions

| Plan | Price | Stripe Product / Price ID | Live Checkout Link |
|---|---|---|---|
| Monthly | $2.99/mo | `price_1UeE35FtqvN4GZH3CkiSb4uj` | [Checkout](https://buy.stripe.com/8x24gz7Vt3lD2TR5ayg3602) |
| Yearly | $19.99/yr | `price_1UeE3xFtqvN4GZH3pIrN6amC` | [Checkout](https://buy.stripe.com/aFa9ATdfNcWd2TRfPcg360c) |
| Lifetime | $29.99 one-time | `price_1UeE5CFtqvN4GZH3juaGGEq5` | [Checkout](https://buy.stripe.com/fZueVd3Fdf4l9if1Ymg360m) |

- **Stripe Product ID:** `prod_VfZA0QdeRm3Opf`

## Local Installation (Chrome)
1. Open `chrome://extensions`
2. Enable **Developer mode**
3. Click **Load unpacked** and select this repository root

## Verification & Chrome Web Store Packaging
```bash
node tests/verify.mjs .
```
Outputs a store-ready archive at `dist/lexipop-extension-v1.0.0.zip`.
