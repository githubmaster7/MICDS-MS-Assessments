// charts.js
function clearCanvas(ctx){
  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
}

export function drawDonutCounts(canvas, counts, title){
  const ctx = canvas.getContext("2d");
  clearCanvas(ctx);

  const W = canvas.width, H = canvas.height;
  const cx = W/2, cy = H/2;
  const radius = Math.min(W, H)*0.33;
  const hole = radius * 0.55;

  // no custom colors requested: we use default palette-like but still need distinct fills
  const colors = {
    4: "#16a34a",
    3: "#4ade80",
    2: "#facc15",
    1: "#ef4444",
  };

  const total = (counts[1]||0)+(counts[2]||0)+(counts[3]||0)+(counts[4]||0);

  // title
  ctx.font = "700 14px ui-sans-serif, system-ui";
  ctx.fillStyle = "#111827";
  ctx.fillText(title, 14, 22);

  if (!total){
    ctx.font = "600 12px ui-sans-serif, system-ui";
    ctx.fillStyle = "#6b7280";
    ctx.fillText("No data yet", 14, 44);
    return;
  }

  let start = -Math.PI/2;
  const order = [4,3,2,1];
  for (const k of order){
    const v = counts[k] || 0;
    const frac = v / total;
    const end = start + frac * Math.PI * 2;

    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, radius, start, end);
    ctx.closePath();
    ctx.fillStyle = colors[k];
    ctx.fill();

    start = end;
  }

  // hole
  ctx.beginPath();
  ctx.arc(cx, cy, hole, 0, Math.PI*2);
  ctx.fillStyle = "#ffffff";
  ctx.fill();

  // center text
  ctx.font = "900 20px ui-sans-serif, system-ui";
  ctx.fillStyle = "#111827";
  ctx.textAlign = "center";
  ctx.fillText(String(total), cx, cy+7);
  ctx.textAlign = "left";

  // legend
  const legendX = 14, legendY = H - 70;
  ctx.font = "700 12px ui-sans-serif, system-ui";
  let y = legendY;
  for (const k of order){
    ctx.fillStyle = colors[k];
    ctx.fillRect(legendX, y, 10, 10);
    ctx.fillStyle = "#111827";
    ctx.fillText(`Score ${k}: ${counts[k]||0}`, legendX+16, y+10);
    y += 16;
  }
}
