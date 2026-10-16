# ProxyProof Brand Guidelines v1.0

## Quick Reference
| Element | Specification |
|---------|---------------|
| Primary Color | #0B284C |
| Secondary Color | #009D96 |
| Accent Color | #007AFF |
| Primary Font | System San Francisco / Roboto (Apple HIG clean sans) |
| Voice | Authoritative, Effortless, Cryptographically Precise |

---

## 1. Visual Identity & Brand Metaphor

ProxyProof is an anti-proxy, privacy-preserving classroom check-in system.
The visual identity fuses **institutional academic trust** with **cutting-edge cryptographic wireless proximity**.

- **The Shield (#0B284C):** Represents institutional protection, anti-proxy fraud prevention, and academic record integrity.
- **The Checkmark & Broadcast Wave (#009D96):** Represents instantaneous Bluetooth verification, live cryptographic presence, and fluid student experience.

---

## 2. Color Palette

### Primary Colors
| Name | Hex | RGB | Usage |
|------|-----|-----|-------|
| Deep Academic Navy | #0B284C | rgb(11, 40, 76) | Primary brand mark, headers, primary buttons, authoritative badges |
| Deep Navy Dark | #06172D | rgb(6, 23, 45) | Active state, contrast borders |
| Navy Tint Light | #E6ECF2 | rgb(230, 236, 242) | Soft navy surface, highlight chips |

### Secondary Colors
| Name | Hex | RGB | Usage |
|------|-----|-----|-------|
| Signal Teal | #009D96 | rgb(0, 157, 150) | Verification states, active broadcast indicators, primary interactive accents |
| Signal Teal Dark | #007671 | rgb(0, 118, 113) | Pressed button states |
| Ice Cyan Light | #E0F4F4 | rgb(224, 244, 244) | Subtle badges, active card backgrounds, tinted icon containers |

### Accent Colors
| Name | Hex | RGB | Usage |
|------|-----|-----|-------|
| Campus System Blue | #007AFF | rgb(0, 122, 255) | Secondary system accent, links |
| Warning Amber | #FF9500 | rgb(255, 149, 0) | Proximity alerts, pending approvals |
| System Red | #FF3B30 | rgb(255, 59, 48) | Destructive actions, session expired |

### Neutral Palette (Apple HIG Compliant)
| Token | Light Mode | Dark Mode | Usage |
|-------|------------|-----------|-------|
| Canvas Background | #F2F4F7 | #0B111A | Primary screen container background |
| Surface Card | #FFFFFF | #121A24 | Cards, modals, lists, navigation bars |
| Surface Elevated | #FFFFFF | #1A2433 | Popovers, alert dialogs, active bottom sheets |
| Border / Separator | #E2E6ED | #223042 | Hairline dividers, card outlines |
| Text Primary | #0B192C | #F0F4F8 | Headings, primary labels, values |
| Text Secondary | #5A697E | #8B9BB0 | Subtitles, helper text, status labels |
| Text Muted | #8E9BAE | #55667A | Timestamps, inactive tabs, captions |

---

## 3. Logo Specifications & Usage

### Master Asset: `frontend/assets/logo.svg`
The official brand identity includes:
1. **Primary Symbol (The ProxyProof Shield Mark):**
   - Navy outer boundary shield
   - Signal Teal dynamic checkmark
   - Dual-arc wireless broadcast resonance waves
2. **Wordmark:**
   - Custom geometric sans typography in `#0B284C`

### Clear Space & Scale
- **App Header Mark:** 28×28 pt to 36×36 pt
- **Login / Hero Lockup:** 64×64 pt to 80×80 pt
- **Clear Space:** Minimum padding of 0.5× symbol width around all sides
- **Monochrome / Dark Mode:** In pure dark mode, the navy fill adapts to crisp white `#FFFFFF` or elevated steel `#E2E8F0` while maintaining the Signal Teal `#009D96` broadcast checkmark.

---

## 4. Typography Hierarchy

| Style | Font Family | Size | Weight | Tracking | Line Height |
|-------|-------------|------|--------|----------|-------------|
| Display / Hero | System (SF / Roboto) | 28px | 800 (Heavy) | -0.6px | 34px |
| Large Title | System (SF / Roboto) | 22px | 700 (Bold) | -0.4px | 28px |
| Title 2 / Card Header | System (SF / Roboto) | 17px | 600 (Semibold) | -0.2px | 22px |
| Body / Form Inputs | System (SF / Roboto) | 15px | 400 (Regular) | -0.1px | 20px |
| Subhead / Metric | System (SF / Roboto) | 13px | 600 (Semibold) | 0px | 18px |
| Caption / Badge | System (SF / Roboto) | 11px | 700 (Bold) | +0.4px | 14px |

---

## 5. Tone of Voice & UX Microcopy

| Principle | We Are | We Are Not | Example |
|-----------|--------|------------|---------|
| **Confidence** | Direct, clear, institutional | Bureaucratic or vague | "Attendance Verified" instead of "Transaction Status: OK" |
| **Clarity** | Human and physical | Cryptographic jargon overload | "Move closer to instructor" instead of "RSSI -82dBm below delta" |
| **Integrity** | Transparent and accountable | Punitive or harsh | "Device approval pending admin review" |
