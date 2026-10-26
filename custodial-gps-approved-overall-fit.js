(function(root){
  'use strict';
  // Eric accepted this exact OVERALL affine visual reference. It is not a
  // survey, a measured ground/phone accuracy bound, or a collection permission.
  const ANCHOR_SHA='3bf0761cb42f1e5f9b435ae3774ea3c018c749daf261de44357880ae3841ebef';
  const ARTWORK_SHA='7da4c536fc40b261a4466670c19d7e0e7af26ecc833d84c34f2c5b00474a9072';
  const SEAL_SHA='385cd19075412791f8e4fec003c74aaee6bcaf17a98959fecba7dbdaa0294c64';
  const ORIGINAL_ARTWORK='./dashboard-map-assets/Memphis-Zoo-Transparent-Framed-Clean-Base-20261003.png';
  const WIDTH=2040,HEIGHT=890,RADIUS=6378137;
  const C=Object.freeze([
    Object.freeze([1.6995804656178382,0.20900071821384034]),
    Object.freeze([-0.21547359918899872,1.6854965938053965]),
    Object.freeze([37.00399332225882,-99.32135246297207])
  ]);
  const M=Object.freeze([
    Object.freeze([1.6746210164321618,-4.583961295865573e-05]),
    Object.freeze([0.00010785930021506296,-1.674682174984381])
  ]);
  const ORIGIN=Object.freeze([-10017920.697629387,4184369.2619002587]);
  const OFFSET=Object.freeze([1053.3298231916808,476.6812487653435]);
  const admitted=new WeakSet();
  const finite=n=>typeof n==='number'&&Number.isFinite(n);
  const point=p=>finite(p?.x)&&finite(p?.y);
  const inside=p=>point(p)&&p.x>=0&&p.x<=WIDTH&&p.y>=0&&p.y<=HEIGHT;
  const fail=reason=>{throw new Error('Accepted overall map: '+reason);};
  function nativeToRaster(p){
    if(!point(p)||p.x<0||p.x>1282||p.y<0||p.y>550)fail('original approved canvas point required');
    return Object.freeze({x:p.x*C[0][0]+p.y*C[1][0]+C[2][0],
      y:p.x*C[0][1]+p.y*C[1][1]+C[2][1]});
  }
  function rasterToNative(p){
    if(!point(p))fail('finite raster point required');
    const dx=p.x-C[2][0],dy=p.y-C[2][1],d=C[0][0]*C[1][1]-C[0][1]*C[1][0];
    return Object.freeze({x:(dx*C[1][1]-dy*C[1][0])/d,
      y:(dy*C[0][0]-dx*C[0][1])/d});
  }
  function mercatorToRaster(x,y){
    const dx=x-ORIGIN[0],dy=y-ORIGIN[1];
    return Object.freeze({x:dx*M[0][0]+dy*M[1][0]+OFFSET[0],
      y:dx*M[0][1]+dy*M[1][1]+OFFSET[1]});
  }
  function rasterToWgs84(p){
    if(!inside(p))fail('accepted raster extent required');
    const dx=p.x-OFFSET[0],dy=p.y-OFFSET[1],d=M[0][0]*M[1][1]-M[0][1]*M[1][0];
    const mx=(dx*M[1][1]-dy*M[1][0])/d+ORIGIN[0];
    const my=(dy*M[0][0]-dx*M[0][1])/d+ORIGIN[1];
    return Object.freeze({latitude:(2*Math.atan(Math.exp(my/RADIUS))-Math.PI/2)*180/Math.PI,
      longitude:mx/RADIUS*180/Math.PI});
  }
  function transformAnchors(original){
    if(original?.digest!==ANCHOR_SHA||original.width!==1282||original.height!==550||
      original.locations?.length!==47||new Set(original.locations.map(p=>p.locationId)).size!==47)
      fail('exact unchanged original 47-ID/34-offset source required');
    const locations=original.locations.map(p=>{
      const canvasPoint=nativeToRaster(p.canvasPoint);
      if(!inside(canvasPoint))fail('original decorative placement outside accepted raster');
      return Object.freeze({...p,originalCanvasPoint:p.canvasPoint,canvasPoint});
    });
    const result=Object.freeze({digest:ANCHOR_SHA,width:WIDTH,height:HEIGHT,acceptedFitSealSha256:SEAL_SHA,
      locations:Object.freeze(locations)});
    admitted.add(result);return result;
  }
  const quality=Object.freeze({kind:'OWNER_ACCEPTED_OVERALL_VISUAL_REFERENCE',
    absoluteGroundAccuracyVerified:false,walkingDomainVerified:false,
    registrationUncertaintyM:null,reportedDeviceAccuracyOnly:true,
    approximateSourceComparisonRmsFt:16.409646919190738,
    disclosedMemMexSourceComparisonFt:32.22164405094598,
    geographicAcceptanceTolerance:null,postinstallFieldAcceptance:'NOT_RUN'});
  function admit({anchors}){
    if(!admitted.has(anchors)||anchors.acceptedFitSealSha256!==SEAL_SHA)
      fail('own exact accepted display-anchor projection required');
    // Full matrix operator norm converts a reported ground accuracy circle to
    // the displayed Mercator pixels. It is NOT a total map uncertainty bound.
    const a=M[0][0],b=M[1][0],c=M[0][1],d=M[1][1];
    const u=a*a+c*c,v=b*b+d*d,w=a*b+c*d;
    const pixelsPerMercatorM=Math.sqrt((u+v+Math.hypot(u-v,2*w))/2);
    function project(latitude,longitude,accuracyM){
      if(!finite(latitude)||Math.abs(latitude)>85.05112878||!finite(longitude)||
        Math.abs(longitude)>180||!finite(accuracyM)||accuracyM<=0)
        return Object.freeze({ok:false,reason:'invalid_measured_position_or_reported_accuracy'});
      const lat=latitude*Math.PI/180;
      const canvas=mercatorToRaster(RADIUS*longitude*Math.PI/180,
        RADIUS*Math.log(Math.tan(Math.PI/4+lat/2)));
      if(!inside(canvas))return Object.freeze({ok:false,reason:'outside_accepted_raster_extent'});
      const uncertaintyCanvasPx=accuracyM/Math.cos(lat)*pixelsPerMercatorM;
      if(!finite(uncertaintyCanvasPx)||uncertaintyCanvasPx>Math.min(canvas.x,canvas.y,WIDTH-canvas.x,HEIGHT-canvas.y))
        return Object.freeze({ok:false,reason:'reported_accuracy_outside_accepted_raster_extent'});
      return Object.freeze({ok:true,canvas,reportedAccuracyM:accuracyM,uncertaintyM:null,
        uncertaintyCanvasPx,absoluteUncertaintyUnknown:true,
        quality:'reported_device_accuracy_only_map_error_unknown',referenceSealSha256:SEAL_SHA});
    }
    return Object.freeze({project,quality,referenceSealSha256:SEAL_SHA});
  }
  const api=Object.freeze({ANCHOR_SHA,ARTWORK_SHA,SEAL_SHA,ORIGINAL_ARTWORK,WIDTH,HEIGHT,
    nativeToRaster,rasterToNative,rasterToWgs84,transformAnchors,admit,quality});
  root.MemphisCustodialGpsApprovedOverallFit=api;
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof globalThis!=='undefined'?globalThis:this);
