/* Blues' articulated artwork. Coordinates are relative to the same ground anchor as Pinky. */
const drawBlues = (() => {
  const blue = '#164bd7';
  const outline = '#102c8d';
  const pink = '#ff689e';
  const cream = '#fff2d7';
  const gold = '#ffd846';

  const earShell = new Path2D('M-8 3 C-13-8-15-27-8-36 C-1-45 8-40 9-29 C10-18 6-5 4 3Z');
  const earTrim = new Path2D('M-5 0 Q-10-6-8-12 Q-12-17-9-21 Q-12-27-7-29 Q-8-35-3-35 Q0-39 3-33 Q7-30 5-25 Q7-21 3-17 Q5-13 1-9 Q3-5 0 1Z');
  const earPink = new Path2D('M-4 0 Q-9-7-7-13 Q-11-18-7-22 Q-9-28-5-30 Q-4-34-1-34 Q1-31 0-27 Q3-24-1-20 Q1-16-3-12 Q0-7-3-3Z');
  const torso = new Path2D('M-11-44 C-23-39-25-22-21-12 C-17-2 16-1 22-12 C27-23 22-40 11-44Z');
  const head = new Path2D('M0-73 C-17-73-29-65-30-52 C-33-40-22-34 0-34 C22-34 33-40 30-52 C29-65 17-73 0-73Z');
  const heart = new Path2D('M0 5 C-2 3-8-1-5-4 Q-2-7 0-3 Q3-7 6-4 C8-1 3 3 0 5Z');
  const carrot = new Path2D('M-6-6 Q2-10 7-6 Q5 3 0 14 Q-2 16-4 10Z');
  const cap = new Path2D('M-14-71 Q-13-84 0-86 Q11-86 14-73 Q20-72 18-70 Q5-67-14-71Z');
  const capGreen = new Path2D('M-13-72 Q-12-79-8-82 Q-3-82 1-71Z');
  const capYellow = new Path2D('M-1-85 Q8-85 11-78 L1-72Z');
  const tooth = new Path2D('M-3-43 H3 L2-38 H-2Z');
  const star = new Path2D('M0-4 1.2-1.3 4-.9 2 1.1 2.5 4 0 2.6-2.5 4-2 1.1-4-.9-1.2-1.3Z');
  const diamond = new Path2D('M0-4 3.5 0 0 4-3.5 0Z');

  function fill(ctx, path, color, stroke) {
    ctx.fillStyle = color;
    ctx.fill(path);
    if (stroke) {
      ctx.strokeStyle = stroke;
      ctx.stroke(path);
    }
  }

  function ellipse(ctx, x, y, rx, ry, color, stroke) {
    ctx.beginPath();
    ctx.ellipse(x,y,rx,ry,0,0,Math.PI*2);
    ctx.fillStyle=color;
    ctx.fill();
    if (stroke) {
      ctx.strokeStyle=stroke;
      ctx.stroke();
    }
  }

  function ear(ctx, x, y, rotation, mirror) {
    ctx.save();
    ctx.translate(x,y);
    ctx.rotate(rotation);
    ctx.scale(mirror,1);
    fill(ctx,earShell,blue,outline);
    fill(ctx,earTrim,cream);
    fill(ctx,earPink,pink);
    ctx.restore();
  }

  function foot(ctx, x, y, near) {
    ellipse(ctx,x,y,near?9:8,6.4,blue,outline);
    ellipse(ctx,x+2,y+.25,near?5.8:4.2,4,pink);
  }

  function arm(ctx, x, y, angle) {
    ctx.save();
    ctx.translate(x,y);
    ctx.rotate(angle);
    ellipse(ctx,0,6,6,8,blue,outline);
    ellipse(ctx,0,8,3.25,3.4,pink);
    for (const dx of [-2.8,0,2.8]) ellipse(ctx,dx,3.8,1.05,1.1,pink);
    ctx.restore();
  }

  function belly(ctx) {
    ellipse(ctx,0,-23,13,16,cream);
    ctx.save();
    ctx.translate(0,-21);
    ctx.rotate(-.09);
    ellipse(ctx,-3,-9,2,4,'#4bb774');
    ellipse(ctx,1,-10,2,4,'#209966');
    ellipse(ctx,4,-8,2,3,'#4bb774');
    ctx.lineWidth=1.25;
    fill(ctx,carrot,'#ff8a32','#bd481f');
    ctx.strokeStyle='#d05a25';
    ctx.beginPath();
    ctx.moveTo(-4,-2);ctx.lineTo(-1,-3);
    ctx.moveTo(2,2);ctx.lineTo(4,1);
    ctx.moveTo(-3,5);ctx.lineTo(-.5,4);
    ctx.stroke();
    ctx.restore();
    for (const [x,y,scale] of [[-18,-28,.67],[18,-28,.67],[-15,-13,.58],[15,-13,.58]]) {
      ctx.save();
      ctx.translate(x,y);
      ctx.scale(scale,scale);
      fill(ctx,heart,pink);
      ctx.restore();
    }
  }

  function hat(ctx, phase) {
    fill(ctx,cap,'#ff8fbc',outline);
    fill(ctx,capGreen,'#1eb19a');
    fill(ctx,capYellow,gold);
    ellipse(ctx,5,-71,12,2.6,'#fb69a6');
    ellipse(ctx,0,-88,1.65,2.7,gold);
    ctx.save();
    ctx.translate(0,-91);
    ctx.scale(.45+Math.abs(Math.cos(phase))*.55,1);
    ellipse(ctx,-5.4,0,5.3,2.3,gold,'#b87814');
    ellipse(ctx,5.4,0,5.3,2.3,gold,'#b87814');
    ellipse(ctx,0,0,1.8,1.8,gold);
    ctx.restore();

    ctx.strokeStyle=gold;
    ctx.lineWidth=1.8;
    ctx.beginPath();
    ctx.moveTo(-21,-66);ctx.quadraticCurveTo(0,-57,21,-66);ctx.stroke();
    for (const x of [-17,17]) {
      ctx.save();ctx.translate(x,-59);fill(ctx,star,gold);ctx.restore();
    }
    ctx.save();ctx.translate(0,-62);fill(ctx,diamond,'#fff8ed','#d49b29');ctx.restore();
  }

  function face(ctx, hurt, blink) {
    for (const x of [-10,10]) {
      if (hurt || blink) {
        ctx.strokeStyle=outline;
        ctx.lineWidth=2.2;
        ctx.beginPath();
        if (hurt) {
          ctx.moveTo(x-3.2,-53);ctx.lineTo(x+3.2,-47);
          ctx.moveTo(x+3.2,-53);ctx.lineTo(x-3.2,-47);
        } else {
          ctx.moveTo(x-4,-50);ctx.quadraticCurveTo(x,-47,x+4,-50);
        }
        ctx.stroke();
      } else {
        // Dark eyes sit directly against the blue face, with three internal reflections.
        ellipse(ctx,x,-50,5.6,6.4,'#292936');
        ellipse(ctx,x-1.8,-52.4,1.4,1.4,'#ffffff');
        ellipse(ctx,x+.9,-51.5,.65,.65,'#fff8f6');
        ellipse(ctx,x+1.65,-47.1,.74,.74,'#a5a6b4');
      }
    }
    ellipse(ctx,-18,-43,5.2,2.8,pink);
    ellipse(ctx,18,-43,5.2,2.8,pink);
    ctx.lineWidth=1.3;
    fill(ctx,tooth,'#ffffff',outline);
    ellipse(ctx,0,-45.6,1.4,1,outline);
    ctx.strokeStyle=outline;
    ctx.beginPath();
    ctx.moveTo(-5,-44);ctx.quadraticCurveTo(-3,-40,0,-44);
    ctx.quadraticCurveTo(3,-40,5,-44);ctx.stroke();
  }

  return (ctx,state) => {
    const stride=Math.sin(state.runCycle);
    const step=state.isGrounded ? stride*8 : 5;
    const earMotion=state.isGrounded ? stride*.055 : -.09;
    ctx.save();
    ctx.lineJoin='round';
    ctx.lineCap='round';
    ctx.lineWidth=2.15;

    // Match Pinky's paint order: trailing foot behind the torso, leading foot above it.
    ellipse(ctx,-22,-17+stride*1.4,5.3,4.4,blue,outline);
    foot(ctx,-10-step,-8,false);
    fill(ctx,torso,blue,outline);
    belly(ctx);
    foot(ctx,10+step,-7,true);
    arm(ctx,-19,-36,state.hurt?1.2:state.isGrounded?.42+stride*.55:1.8);
    arm(ctx,19,-36,state.hurt?-1.2:state.isGrounded?-.42+stride*.55:-1.8);

    ctx.translate(0,-(state.isGrounded?Math.abs(stride):0));
    ear(ctx,-16,-67,-.09+earMotion,1);
    ear(ctx,16,-67,.09-earMotion,-1);
    fill(ctx,head,blue,outline);
    hat(ctx,state.runCycle);
    face(ctx,state.hurt,state.blinkTimer%180>173);
    ctx.restore();
  };
})();
