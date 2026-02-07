#!/usr/bin/env bash
# Maven Calculatie — start backend + frontend met één commando
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

echo "🚀 Maven Calculatie starten..."

# ── Backend (FastAPI) ──────────────────────────
echo "📦 Backend starten op port 8000..."
cd "$SCRIPT_DIR"
python3 -m uvicorn api.main:app --reload --port 8000 &
BACKEND_PID=$!

# ── Frontend (Vite) ────────────────────────────
echo "🎨 Frontend starten op port 5173..."
cd "$SCRIPT_DIR/frontend"
npm run dev &
FRONTEND_PID=$!

# ── Cleanup bij afsluiten ──────────────────────
cleanup() {
  echo ""
  echo "🛑 Stoppen..."
  kill $BACKEND_PID 2>/dev/null || true
  kill $FRONTEND_PID 2>/dev/null || true
  exit 0
}
trap cleanup SIGINT SIGTERM

echo ""
echo "✅ Klaar! Open http://localhost:5173"
echo "   (Ctrl+C om te stoppen)"
echo ""

# Wacht op een van beide processen
wait
