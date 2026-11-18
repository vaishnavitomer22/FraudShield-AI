"""
Draws the architecture diagram, ML workflow diagram and evaluation figures.

    pip install -r requirements.txt
    node model/evaluate_model.js        # creates model/evaluation_results.json
    python docs/generate_figures.py

Evaluation figures are drawn from model/evaluation_results.json, i.e. from the real model output.
"""
import json
from pathlib import Path
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from matplotlib.patches import FancyBboxPatch, FancyArrowPatch

HERE = Path(__file__).resolve().parent
E = json.loads((HERE.parent / "model" / "evaluation_results.json").read_text(encoding="utf-8"))
NAVY, BLUE, PURPLE, CYAN, RED, GREEN, GREY = "#0B1437", "#3B82F6", "#8B5CF6", "#06B6D4", "#EF4444", "#10B981", "#475569"


def box(ax, x, y, w, h, title, body, color):
    ax.add_patch(FancyBboxPatch((x, y), w, h, boxstyle="round,pad=0.3,rounding_size=1.2", fc="white", ec=color, lw=2))
    ax.add_patch(FancyBboxPatch((x, y + h - 6), w, 6, boxstyle="round,pad=0.3,rounding_size=1.2", fc=color, ec=color))
    ax.text(x + w / 2, y + h - 3, title, ha="center", va="center", color="white", fontsize=9, fontweight="bold")
    ax.text(x + w / 2, y + (h - 6) / 2, body, ha="center", va="center", color="#1f2937", fontsize=8)


def arrow(ax, x1, y1, x2, y2, style="-|>"):
    ax.add_patch(FancyArrowPatch((x1, y1), (x2, y2), arrowstyle=style, mutation_scale=13, color=GREY, lw=1.6))


# ---------- architecture ----------
fig, ax = plt.subplots(figsize=(11, 6)); ax.axis("off"); ax.set_xlim(0, 110); ax.set_ylim(0, 60)
ax.text(2, 57, "Runtime — the website (everything runs in the browser, no server)", fontsize=10, fontweight="bold", color=NAVY)
runtime = [(2, "Transaction form", "type, amount,\nsender & receiver\nbalances, hour", BLUE), (24, "Model engine", "frontend/\nFraudShield_AI.html\n(inline copy of\nfraud_model.js)", PURPLE),
           (46, "Result panel", "FRAUD / LEGITIMATE\nrisk gauge\nexplanations", RED), (68, "Dashboard", "counts, donut,\nbars, type chart,\nrecent history", GREEN), (90, "localStorage", "transaction\nhistory kept in\nthe browser", GREY)]
for x, t, b, c in runtime: box(ax, x, 34, 18, 20, t, b, c)
for x in (20.5, 42.5, 64.5, 86.5): arrow(ax, x, 44, x + 3, 44)
ax.text(2, 28, "Development — Node.js scripts", fontsize=10, fontweight="bold", color=NAVY)
dev = [(2, "generate_dataset.js", "12,000 synthetic\nPaySim-style rows\n→ CSV", CYAN), (24, "model/fraud_model.js", "generator · features\ntraining · predict\n(single source of truth)", PURPLE),
       (46, "train_model.js", "trains, saves\nmodel/\nfraud_model.json", BLUE), (68, "evaluate_model.js", "confusion matrix,\nreport, ROC,\nfeature weights", RED), (90, "load_model.js", "loads the saved\nmodel and\npredicts", GREEN)]
for x, t, b, c in dev: box(ax, x, 3, 18, 20, t, b, c)
arrow(ax, 20.5, 13, 23.5, 13, "<|-"); arrow(ax, 42.5, 13, 45.5, 13, "<|-"); arrow(ax, 64.5, 13, 67.5, 13, "<|-"); arrow(ax, 86.5, 13, 89.5, 13, "<|-")
ax.annotate("", xy=(33, 33), xytext=(33, 24), arrowprops=dict(arrowstyle="<|-|>", color=PURPLE, lw=1.6, linestyle="--"))
ax.text(35, 28.5, "scripts and website use identical model code (checked by tests)", fontsize=8, color=PURPLE, va="center")
plt.savefig(HERE / "architecture.png", dpi=170, bbox_inches="tight", facecolor="white"); plt.close()

# ---------- ML workflow ----------
fig, ax = plt.subplots(figsize=(11, 5)); ax.axis("off"); ax.set_xlim(0, 110); ax.set_ylim(0, 48)
steps = [("1  Generate data", "12,000 synthetic\nPaySim-style\ntransactions\n(fixed seed)", CYAN), ("2  Split", "9,600 training\n2,400 hold-out\n(hold-out never\nused to train)", BLUE),
         ("3  Engineer features", "15 features:\nbalance drain,\nreceiver state,\nerrors, type, hour", RED), ("4  Preprocess", "standardise each\nfeature using\ntraining mean\nand std only", PURPLE),
         ("5  Train", "logistic regression\nclass weight 4\nL2 = 0.001\n400 epochs", PURPLE), ("6  Evaluate", "confusion matrix\nprecision / recall\nF1, ROC AUC\nweights", GREEN),
         ("7  Save", "model/\nfraud_model.json\n(weights, mean,\nstd, bias)", BLUE), ("8  Predict", "probability ≥ 0.5\n→ FRAUD else\nLEGITIMATE\n+ explanation", RED)]
pos = [(2, 26), (29, 26), (56, 26), (83, 26), (83, 2), (56, 2), (29, 2), (2, 2)]
for (x, y), (t, b, c) in zip(pos, steps): box(ax, x, y, 24, 20, t, b, c)
for i in range(3): arrow(ax, pos[i][0] + 24.5, 36, pos[i + 1][0] - 0.5, 36)
arrow(ax, 95, 25.5, 95, 22.5)
for i in range(4, 7): arrow(ax, pos[i][0] - 0.5, 12, pos[i + 1][0] + 24.5, 12)
plt.savefig(HERE / "ml_workflow.png", dpi=170, bbox_inches="tight", facecolor="white"); plt.close()

# ---------- confusion matrix ----------
cm = E["confusionMatrix"]; fig, ax = plt.subplots(figsize=(4.8, 4.2))
cells = [[(cm["tn"], "True negative", GREEN), (cm["fp"], "False positive", RED)], [(cm["fn"], "False negative", RED), (cm["tp"], "True positive", GREEN)]]
for i in range(2):
    for j in range(2):
        v, lab, c = cells[i][j]
        ax.add_patch(plt.Rectangle((j, 1 - i), 1, 1, fc=c, alpha=0.18, ec="white", lw=3))
        ax.text(j + .5, 1 - i + .56, f"{v:,}", ha="center", va="center", fontsize=22, fontweight="bold", color="#111827")
        ax.text(j + .5, 1 - i + .25, lab, ha="center", fontsize=9.5, color="#374151")
ax.set_xlim(0, 2); ax.set_ylim(0, 2); ax.set_xticks([.5, 1.5]); ax.set_xticklabels(["Predicted\nLEGITIMATE", "Predicted\nFRAUD"])
ax.set_yticks([.5, 1.5]); ax.set_yticklabels(["Actual\nFRAUD", "Actual\nLEGITIMATE"]); ax.tick_params(length=0, labelsize=9)
for s in ax.spines.values(): s.set_visible(False)
ax.set_title(f"Confusion matrix — {E['holdoutRecords']:,} hold-out transactions (synthetic)", fontsize=10, fontweight="bold", color=NAVY)
plt.savefig(HERE / "confusion_matrix.png", dpi=170, bbox_inches="tight", facecolor="white"); plt.close()

# ---------- feature weights ----------
names = {"amt": "Transaction amount (log)", "frac": "Share of balance moved", "drain": "Sender left with ₹0", "drainRisky": "Drain via transfer / cash-out", "errOrg": "Sender balance mismatch",
         "errDest": "Receiver balance mismatch", "destEmpty": "Receiver was empty", "destFlat": "Receiver balance unchanged", "oldOrg": "Sender balance (log)", "night": "Night-time (00–05h)",
         "t_PAYMENT": "Type: PAYMENT", "t_TRANSFER": "Type: TRANSFER", "t_CASH_OUT": "Type: CASH_OUT", "t_CASH_IN": "Type: CASH_IN", "t_DEBIT": "Type: DEBIT"}
w = sorted(E["featureWeights"], key=lambda d: d["weight"]); fig, ax = plt.subplots(figsize=(7.2, 4.8))
ax.barh([names[d["feature"]] for d in w], [d["weight"] for d in w], color=[RED if d["weight"] > 0 else BLUE for d in w]); ax.axvline(0, color="#334155", lw=1)
ax.set_xlabel("Learned weight on standardised features (positive raises fraud risk)", fontsize=9); ax.tick_params(labelsize=8.5)
for s in ("top", "right"): ax.spines[s].set_visible(False)
ax.set_title("Feature weights learned by the model", fontsize=11, fontweight="bold", color=NAVY)
plt.savefig(HERE / "feature_weights.png", dpi=170, bbox_inches="tight", facecolor="white"); plt.close()

# ---------- ROC ----------
x, y = zip(*E["roc"]); fig, ax = plt.subplots(figsize=(4.8, 4.4))
ax.plot(x, y, color=BLUE, lw=2.2, label=f"Model (AUC = {E['auc']:.3f})"); ax.plot([0, 1], [0, 1], "--", color="#94a3b8", label="Random guess")
ax.set_xlabel("False positive rate"); ax.set_ylabel("True positive rate (recall)"); ax.legend(loc="lower right", fontsize=9)
for s in ("top", "right"): ax.spines[s].set_visible(False)
ax.set_title("ROC curve — hold-out set (synthetic data)", fontsize=10, fontweight="bold", color=NAVY)
plt.savefig(HERE / "roc_curve.png", dpi=170, bbox_inches="tight", facecolor="white"); plt.close()
print("Figures written to docs/")
