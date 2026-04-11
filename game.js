// ===== 要素 =====
const video = document.getElementById("video")
const canvas = document.getElementById("canvas")
const ctx = canvas.getContext("2d")
const info = document.getElementById("info")

canvas.width = window.innerWidth
canvas.height = window.innerHeight

// ===== カメラ（軽量化） =====
navigator.mediaDevices.getUserMedia({
  video: { width: 640, height: 480 }
}).then(stream=>{
  video.srcObject = stream
  init()
})

// ===== 状態 =====
let mode=0, count=0
let footUp=false, jumpUp=false

window.startGame = function(m){
  mode=m
  count=0
  ctx.clearRect(0,0,canvas.width,canvas.height)

  if(m===1){
    ctx.fillStyle="rgba(120,120,120,0.7)"
    ctx.fillRect(0,0,canvas.width,canvas.height)
    info.textContent="拭き:0/100"
  }
  if(m===2){
    ctx.fillStyle="white"
    ctx.fillRect(0,0,canvas.width,canvas.height)
    info.textContent="足踏み:0/100"
  }
  if(m===3){
    info.textContent="ジャンプ:0/50"
  }
}

// ===== 拭き =====
function clean(x,y){
  ctx.globalCompositeOperation="destination-out"
  ctx.beginPath()
  ctx.arc(x,y,40,0,Math.PI*2)
  ctx.fill()
  ctx.globalCompositeOperation="source-over"
}

// ===== 初期化 =====
function init(){

// ---- 手 ----
const hands = new Hands({
  locateFile:f=>`https://cdn.jsdelivr.net/npm/@mediapipe/hands/${f}`
})

hands.setOptions({
  maxNumHands:1,
  minDetectionConfidence:0.3,
  minTrackingConfidence:0.3
})

// ---- 姿勢 ----
const pose = new Pose({
  locateFile:f=>`https://cdn.jsdelivr.net/npm/@mediapipe/pose/${f}`
})

pose.setOptions({
  minDetectionConfidence:0.3,
  minTrackingConfidence:0.3
})

hands.onResults(r=>{
  if(mode!==1) return
  if(!r.multiHandLandmarks) return

  count++
  info.textContent=`拭き:${count}/100`

  for(const lm of r.multiHandLandmarks){
    const x=(1-lm[8].x)*canvas.width
    const y=lm[8].y*canvas.height

    clean(x,y)

    // デバッグ点
    ctx.fillStyle="red"
    ctx.fillRect(x,y,5,5)
  }

  if(count>=100){
    ctx.clearRect(0,0,canvas.width,canvas.height)
    info.textContent="クリア！"
  }
})

pose.onResults(r=>{
  if(!r.poseLandmarks) return

  const foot=r.poseLandmarks[27]
  const hip=r.poseLandmarks[24]

  // 足踏み
  if(mode===2){
    if(foot.y<0.6 && !footUp) footUp=true
    if(foot.y>0.7 && footUp){
      footUp=false
      count++
      info.textContent=`足踏み:${count}/100`

      const x=(1-foot.x)*canvas.width
      const y=foot.y*canvas.height
      ctx.fillStyle="gray"
      ctx.fillRect(x,y,10,10)
    }
  }

  // ジャンプ
  if(mode===3){
    if(hip.y<0.4 && !jumpUp) jumpUp=true
    if(hip.y>0.5 && jumpUp){
      jumpUp=false
      count++
      info.textContent=`ジャンプ:${count}/50`

      ctx.fillStyle="white"
      ctx.fillRect(0,canvas.height-count*5,canvas.width,5)
    }
  }
})

// ★負荷軽減（超重要）
async function loop(){
  if(mode===1){
    await hands.send({image:video})
  } else {
    await pose.send({image:video})
  }
  requestAnimationFrame(loop)
}
loop()

}
