// タイトルは端末の丸い文字をCSSでぷっくり表示。ネットの画像・フォントは使わない。
(() => {
  const canvas=document.getElementById('hint-cloud'),g=canvas.getContext('2d');
  g.clearRect(0,0,canvas.width,canvas.height);g.lineJoin='round';g.lineWidth=3;g.strokeStyle='#77718f';
  const grad=g.createLinearGradient(0,8,0,44);grad.addColorStop(0,'#e8e4f3');grad.addColorStop(1,'#a5a0bd');g.fillStyle=grad;
  g.beginPath();g.moveTo(15,40);g.bezierCurveTo(-1,38,2,17,20,21);g.bezierCurveTo(21,3,47,2,51,19);g.bezierCurveTo(71,13,79,41,57,42);g.closePath();g.fill();g.stroke();
  g.strokeStyle='#59516f';g.lineWidth=3;g.lineCap='round';g.beginPath();g.moveTo(24,26);g.lineTo(30,28);g.moveTo(47,26);g.lineTo(41,28);g.moveTo(31,35);g.quadraticCurveTo(36,31,41,35);g.stroke();
  g.fillStyle='#ffe391';g.beginPath();g.moveTo(34,42);g.lineTo(29,51);g.lineTo(35,50);g.lineTo(32,56);g.lineTo(44,45);g.lineTo(37,46);g.closePath();g.fill();
})();
