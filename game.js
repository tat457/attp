const video = document.getElementById("video")
const canvas = document.getElementById("canvas")
const ctx = canvas.getContext("2d")
const info = document.getElementById("info")

canvas.width = window.innerWidth
canvas.height = window.innerHeight

let mode=0, count=0, started=false

// ===== 状態管理 =====
let prevX=null, prevY=null

let footUp=false
let prevFootY=null

let jumpState="ground" // ground → crouch → jump
let baseHipY=null

// ===== カメラ =====
window.startCamera = async function(){
  const stream = await navigator.mediaDevices.getUserMedia({
    video:{facingMode:"user", width:640, height:480}
  })
  video.srcObject = stream
  await video.play()

  video.onloadeddata = ()=>{
    if(!started){
      started=true
      init()
    }
  }
}

// ===== ゲーム開始 =====
window.startGame = function(m){
  mode=m
  count=0
  ctx.clearRect(0,0,canvas.width,canvas.height)

  prevX=null
  prevY=null
  prevFootY=null
  jumpState="ground"

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

const pose = new Pose({
  locateFile:f=>`https://cdn.jsdelivr.net/npm/@mediapipe/pose/${f}`
})

// ===== 手 =====
hands.onResults(r=>{
  if(mode!==1) return
  if(!r.multiHandLandmarks) return

  const lm = r.multiHandLandmarks[0][8]
  const x = (1-lm.x)*canvas.width
  const y = lm.y*canvas.height

  // ★動いたときだけカウント
  if(prevX!==null){
    const dx = x - prevX
    const dy = y - prevY
    const dist = Math.sqrt(dx*dx + dy*dy)

    if(dist > 30){ // ←重要
      count++
      info.textContent=`拭き:${count}/100`
      clean(x,y)
    }
  }

  prevX=x
  prevY=y

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

  // ===== 足踏み =====
  if(mode===2){
    if(prevFootY!==null){
      const dy = foot.y - prevFootY

      if(dy < -0.05) footUp=true

      if(dy > 0.05 && footUp){
        footUp=false
        count++
        info.textContent=`足踏み:${count}/100`

        const x=(1-foot.x)*canvas.width
        const y=foot.y*canvas.height

        ctx.fillStyle="gray"
        ctx.beginPath()
        ctx.arc(x,y,10,0,Math.PI*2)
        ctx.fill()
      }
    }
    prevFootY = foot.y
  }

  // ===== ジャンプ =====
  if(mode===3){

    if(baseHipY===null) baseHipY = hip.y

    const diff = baseHipY - hip.y

    if(jumpState==="ground" && diff < -0.05){
      jumpState="crouch"
    }

    if(jumpState==="crouch" && diff > 0.08){
      jumpState="jump"
      count++
      info.textContent=`ジャンプ:${count}/50`

      ctx.fillStyle="white"
      ctx.fillRect(0,canvas.height-count*5,canvas.width,5)
    }

    if(jumpState==="jump" && Math.abs(diff) < 0.02){
      jumpState="ground"
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
