var xmlns = "http://www.w3.org/2000/svg",
  select = function(s) {
    return document.querySelector(s);
  },
  selectAll = function(s) {
    return document.querySelectorAll(s);
  },
  heartSVG = select('.heartSVG'),
  hit = select('#hit'),
  sparkleGrowGroup = select('#sparkleGrowGroup'),
  sparkleMoveGroup = select('#sparkleMoveGroup'),
  brokenHeartGroup = select('#brokenHeartGroup'),
    sparkleGrowColors = ['#9E31E2','#9E31E2','#9E31E2','#92E8C5','#CDEB8E','#2AD492','#D79DF3'], 
    sparkleMoveColors = ['#E187D2', '#E0A3FF', '#F5BB30', '#9ECA98', '#35A0F0', '#BADAB0', '#33B6E9']



TweenMax.set('svg', {
  visibility:'visible'
})
CSSPlugin.defaultSmoothOrigin = true;
TweenMax.set(['#breakLineL','#breakLineR'], {
  drawSVG:'100% 100%'
})

var tl = new TimelineMax({paused:true, onComplete:goBack});
tl.from('#pinkDot', 1, {
  attr:{
    r:0
  }
})
.set('#greyHeart', {
  scale:0,
  transformOrigin:'50% 100%'
},'-=0.99')
.to('#pinkDot', 1, {
  fill:'#CD8FF7'
},'-=1')
.to('#hole', 1, {
  attr:{
    r:67
  }
},'-=0.5')
.from('#pinkHeart', 1.6, {
  scale:0,
  transformOrigin:'50% 50%',
  ease:Back.easeOut.config(1.2)
},'-=0.5')
.set(['#sparkleGrowGroup', '#sparkleMoveGroup'], {
  alpha:1
},'-=1.5')
.to('#sparkleGrowGroup', 1, {
  scale:1.5, 
  transformOrigin:'50% 50%'

},'-=1.5')
.to('#sparkleMoveGroup', 1, {
  scale:1.2, 
  transformOrigin:'50% 50%'

},'-=1.5')
.staggerTo('#sparkleGrowGroup circle', 2, {
  attr:{
    r:0
  },
  cycle:{
    fill:function(i){
      return sparkleGrowColors[i]
    }
  }
}, 0,'-=0.9')
.staggerTo('#sparkleMoveGroup circle', 0.8, {
  attr:{
    r:0
  },
  cycle:{
    fill:function(i){
      return sparkleMoveColors[i]
    }
  }
}, 0,'-=2')
.addCallback(setUndoLike)
.set('.brokenHeartGroup', {
  alpha:1
})

.set('#pinkHeart', {
  alpha:0
})

.to(['#breakLineL', '#breakLineR'], 3, {
  drawSVG:'0% 100%'
})

.to(['#brokenHeartL'], 4, {
  rotation:-90,
  transformOrigin:'110% 100%',
  ease:Power2.easeIn
},'-=1.5')
.to(['#brokenHeartR'], 4, {
  rotation:90,
  transformOrigin:'10% 100%',
  ease:Power2.easeIn
},'-=4')
.to('#greyHeart', 3, {
  scale:1,
  ease:Power4.easeInOut
},'-=1.6')
.set(['#breakLineL', '#breakLineR'], {
  drawSVG:'0% 0%'
},'-=3')
.to(['#brokenHeartL', '#brokenHeartR'], 0.3,{
  alpha:0
},'-=2')

heartSVG.onclick = function(){
  if(tl.time() === 0){
    tl.play(0);
    
  } else{
    tl.play()
  }
  hit.onmouseout();
}

hit.onmouseover = function(){
   if(tl.time() === 0){
    TweenMax.set('.likePopup', {
      alpha:1
    })
     TweenMax.from('.likePopup', 1, {
      rotation:13,
       transformOrigin:'50% 100%',
      ease:Elastic.easeOut.config(2,0.7)
})
   } else {
    TweenMax.set('.undoLikePopup', {
      alpha:1
    })     
     TweenMax.from('.undoLikePopup', 1, {
      rotation:13,
       transformOrigin:'50% 100%',
      ease:Elastic.easeOut.config(2,0.7)
})     
   }
}

function setUndoLike(){
  
  tl.pause();
  TweenMax.set('.undoLikePopup', {
    alpha:1
  })    
     TweenMax.from('.undoLikePopup', 1, {
      rotation:-13,
       transformOrigin:'50% 100%',
      ease:Elastic.easeOut.config(2,0.7)
})       
}

function goBack(){
  
  tl.pause(0);
  TweenMax.delayedCall(0.4, hit.onmouseover)
}

hit.onmouseout = function(){
  
  TweenMax.set(['.likePopup', '.undoLikePopup'], {
        alpha:0
  })  
   
}

tl.timeScale(4);