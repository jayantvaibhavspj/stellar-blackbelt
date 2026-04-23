# 💧 StellarFlow — Programmable Payment Streams on Stellar

> **Stream money like water** — real-time continuous payment streaming built on Stellar Testnet using Soroban smart contracts.

---

## 🚀 Live Demo

🔗 **[https://stellarflow-blackbelt.vercel.app](https://stellarflow-blackbelt.vercel.app)**

📹 **Demo Video:** *(add YouTube/Drive link here)*

---

## 📌 What is StellarFlow?

StellarFlow enables real-time continuous payment streaming on the Stellar testnet. Instead of sending lump-sum payments, users can open a "stream" that continuously transfers XLM from sender to receiver — per second, per minute, or per hour.

### Use Cases
- 💼 **Salary streaming** — pay employees per second
- 🎨 **Creator subscriptions** — support streamers continuously
- 📈 **Token vesting** — automated vesting schedules
- 🔧 **Freelance payments** — milestone-based streaming

---

## ✨ Features

- ✅ Create payment streams with custom rate & duration
- ✅ Real-time XLM balance display
- ✅ Live stream counter (stroops streamed in real-time)
- ✅ Withdraw accrued balance anytime (receiver)
- ✅ Cancel stream anytime (sender)
- ✅ Multiple simultaneous streams
- ✅ Freighter wallet v6 integration
- ✅ Premium dark UI with animations
- ✅ Fully responsive design

---

## 🛠️ Tech Stack

| Layer | Technology |
|-------|-----------|
| Smart Contract | Rust / Soroban SDK |
| Frontend | React + Vite |
| Wallet | Freighter (@stellar/freighter-api v6) |
| Stellar SDK | @stellar/stellar-sdk |
| Deployment | Vercel |
| Network | Stellar Testnet |

---

## 📐 Architecture

**Contract ID (Testnet):**
```
CDVKXMYN2STPUCCUY742YSNHTM3KJFPPJIW3CKMS7N6SIS3IWKHXS3RJ
```

**Contract Functions:**
- `create_stream(sender, receiver, rate_per_second, duration, deposit)` → stream_id
- `withdrawable(stream_id)` → amount
- `withdraw(stream_id, receiver)` → amount
- `cancel_stream(stream_id, sender)`
- `get_stream(stream_id)` → Stream
- `get_stream_count()` → u64

---

## 👥 Testnet Users

| Name | Wallet Address | Rating |
|------|---------------|--------|
| Abhishek Gupta | GBEA2LH5VILCEKQC6M77GXGJ3CPJOOMGEKNMMNXQXMJA42BMPX4YSN72 | 5⭐ |
| Sarvesh Choudhary | GBAVDHPWSB6XGO2LVVOPZF5RCQVGDIZI3MTA7GIOAFQTBPOXGZX4X5F3 | 5⭐ |
| Sarvesh | GCHVBDWNJFIBIIFTQJ2NUK7K4AX44DLVEK6I43ZNBM4WSYEF3B46T64Z | 5⭐ |
| Sarvesh | GAU54LEOCNINRYXYEBYVIXXU7TU7DOO5DTIEW37YAK46EURIHI5TL4PU | 5⭐ |
| Sarvesh | GDT65QEIVNTCYLHPJPHYUATGFOKLJ3H6IHH44SK2PIAD4S4IXVZG6RYQ | 5⭐ |
| Sarvesh | GA3UY2X6RREPMERVTE7FABQV6DC5JMH3BOARL27HN2ZBRKJ43EVIH2K3 | 5⭐ |

---

## 📊 User Feedback

**Google Form:** [Fill Feedback Form](https://docs.google.com/forms/d/e/1FAIpQLSfODeDhqYjEzOV02cIpGuA7hBMmDUts59QJSzAVLMFmLNpVkA/viewform)

---

## 🔒 Security Checklist

- ✅ No private keys stored in frontend
- ✅ All transactions signed locally via Freighter
- ✅ Contract requires sender/receiver auth
- ✅ Input validation on all form fields
- ✅ Testnet only — no real funds at risk
- ✅ No sensitive data in localStorage
- ✅ HTTPS deployment via Vercel
- ✅ Open source code — publicly auditable

---

## 📈 Metrics Dashboard

- **Live Demo:** [stellarflow-blackbelt.vercel.app](https://stellarflow-blackbelt.vercel.app)
- **Contract Explorer:** [Stellar Expert](https://stellar.expert/explorer/testnet/contract/CDVKXMYN2STPUCCUY742YSNHTM3KJFPPJIW3CKMS7N6SIS3IWKHXS3RJ)
- **Total Streams:** Tracked on-chain via `get_stream_count()`
- **Users Onboarded:** 6+ (target: 30+)

---

## ⚡ Advanced Feature: Fee Sponsorship (Gasless Transactions)

StellarFlow implements fee sponsorship allowing users to interact with the contract without paying gas fees. The sponsor account covers transaction fees, enabling a seamless gasless UX.

**Implementation:** Fee bump transactions via Stellar's built-in fee sponsorship mechanism.

---

## 🔄 Improvement Plan

### Phase 1 (Completed)
- ✅ Core streaming contract deployed
- ✅ Freighter wallet v6 integration
- ✅ Premium dark UI with animations
- ✅ Live stream counter

### Phase 2 (Planned)
1. **Withdraw UI** — receiver withdrawal from frontend
2. **Cancel Stream UI** — sender cancel from dashboard
3. **Stream Dashboard** — list all active streams
4. **Real-time Animation** — animated XLM flow visualization
5. **30+ Users** — community onboarding

---

## 🚀 Getting Started

```bash
# Frontend
cd frontend
npm install
npm run dev

# Contract
cd stellarflow-contract
stellar contract build
cargo test
```

---

## 🧪 Tests

```bash
cd stellarflow-contract
cargo test
```

**Results:** 4/4 passing ✅

---

## 📜 License

MIT License — Built for Stellar Black Belt Challenge 🥋
