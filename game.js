const video = document.getElementById("video")
const canvas = document.getElementById("canvas")
const ctx = canvas.getContext("2d")
const info = document.getElementById("info")

canvas.width = window.innerWidth
canvas.height = window.innerHeight

let mode = 0
let count = 0
let started = false

let footUp = false
let jumpUp = false

// ===== カメラ（iPhone完全対応）=====
window.startCamera = async function(){
  try{
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: "user", width:640, height:480 },
      audio: false
    })

    video.srcObject = stream
    await video.play()

    video.onloadeddata = () => {
      if(!started){
        started = true
        init()
      }
    }

  }catch(e){
    alert("カメラ許可してください")
    console.error(e)
  }
}

// ===== ゲーム開始 =====
window.startGame = function(m){
  mode = m
  count = 0
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

const hands = new Hands({
  locateFile:f=>`https://cdn.jsdelivr.net/npm/@mediapipe/hands/${f}`
})

hands.setOptions({
  maxNumHands:1,
  modelComplexity:0,
  minDetectionConfidence:0.5,
  minTrackingConfidence:0.5
})

const pose = new Pose({
  locateFile:f=>`https://cdn.jsdelivr.net/npm/@mediapipe/pose/${f}`
})

pose.setOptions({
  modelComplexity:0,
  minDetectionConfidence:0.5,
  minTrackingConfidence:0.5
})

// ===== 手 =====
hands.onResults(r=>{
  if(mode!==1) return
  if(!r.multiHandLandmarks) return

  count++
  info.textContent=`拭き:${count}/100`

  for(const lm of r.multiHandLandmarks){
    const x = (1 - lm[8].x) * canvas.width
    const y = lm[8].y * canvas.height
    clean(x,y)
  }

  if(count>=100){
    ctx.clearRect(0,0,canvas.width,canvas.height)
    info.textContent="クリア！"
  }
})

// ===== 姿勢 =====
pose.onResults(r=>{
  if(!r.poseLandmarks) return

  const foot = r.poseLandmarks[27]
  const hip  = r.poseLandmarks[24]

  // 足踏み
  if(mode===2){
    if(foot.y < 0.6 && !footUp) footUp = true
    if(foot.y > 0.7 && footUp){
      footUp = false
      count++
      info.textContent=`足踏み:${count}/100`

      const x = (1 - foot.x) * canvas.width
      const y = foot.y * canvas.height
      ctx.fillStyle="gray"
      ctx.beginPath()
      ctx.arc(x,y,10,0,Math.PI*2)
      ctx.fill()
    }
  }

  // ジャンプ
  if(mode===3){
    if(hip.y < 0.4 && !jumpUp) jumpUp = true
    if(hip.y > 0.5 && jumpUp){
      jumpUp = false
      count++
      info.textContent=`ジャンプ:${count}/50`

      ctx.fillStyle="white"
      ctx.fillRect(0, canvas.height - count*5, canvas.width, 5)
    }
  }
})

// ===== ループ =====
async function loop(){

  if(video.readyState !== 4){
    requestAnimationFrame(loop)
    return
  }

  if(mode===1){
    await hands.send({image:video})
  }else{
    await pose.send({image:video})
  }

  requestAnimationFrame(loop)
}
loop()

}
