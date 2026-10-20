/* PDFQFZ Web UI 前端模块：盖章参数/UI配置持久化/日期格式（V2.4.0.85 拆分）
 * index.html methods 中通过 ...window.PdfqModules.configPersist 注入，
 * this 指向组件实例（Vue3 options API spread 保留绑定），函数体零改动。
 */
window.PdfqModules = window.PdfqModules || {};
window.PdfqModules.configPersist = {
    applyUiConfig(cfg){
      this._shellLoading=true;
      if(cfg.outputQualityDpi!==undefined) this.dpi=String(cfg.outputQualityDpi);
      if(cfg.outputFormat!==undefined){ this.outFormatArr=String(cfg.outputFormat||'pdf').split(',').filter(function(x){ return x==='pdf'||x==='jpg'||x==='png'; }); if(!this.outFormatArr.length){ this.outFormatArr=['pdf']; } } // V1.0.0.47：输出格式多选（逗号分隔存储）
      if(cfg.outputNameMark!==undefined) this.nameMark=cfg.outputNameMark;
      if(cfg.outputNamePos!==undefined) this.namePos=cfg.outputNamePos===1?'before':'after';
      if(cfg.outputNameSeqType!==undefined) this.seqType=['num','upper','lower'][cfg.outputNameSeqType]||'num';
      if(cfg.outputNamePad!==undefined) this.seqPad=String(cfg.outputNamePad||1);
      if(cfg.outputNameTs!==undefined) this.useTs=!!cfg.outputNameTs;
      if(cfg.outputNameTsFormat!==undefined) this.tsFormat=this.fmtToFront(cfg.outputNameTsFormat);
      if(cfg.contextFilterEnabled!==undefined) this.keywordEnabled=!!cfg.contextFilterEnabled;
      if(cfg.contextKeywords!==undefined) this.keywords=cfg.contextKeywords||'盖章,公章';
      if(cfg.contextRange!==undefined) this.ctxRange=cfg.contextRange;
      if(cfg.contextMatch!==undefined) this.matchMode=cfg.contextMatch===1?'all':'any';
      if(cfg.contextExcludeSpaces!==undefined) this.ignoreSpace=!!cfg.contextExcludeSpaces;
      if(cfg.outputDir!==undefined) this.saveDir=cfg.outputDir;
      if(cfg.outputDirLocked!==undefined) this.dirLocked=cfg.outputDirLocked===1;
      if(cfg.version!==undefined) this.versionStr=cfg.version; // V1.0.0.14：完整版本号（使用说明/关于弹窗展示，反馈定位用）
      if(cfg.leftPanelWidth!==undefined && cfg.leftPanelWidth>0){ const mw=Math.min(760,window.innerWidth-10-600); const lo=Math.min(this.leftMinW,mw); this.leftWidth=Math.max(lo,Math.min(cfg.leftPanelWidth,mw)); } // v2.4.0.36：clamp[min(leftMinW,上限),min(760,内容宽-10-600)]
      if(cfg.foldDisp!==undefined) this.stampSect.disp=!!cfg.foldDisp;
      if(cfg.foldRidge!==undefined) this.stampSect.ridge=!!cfg.foldRidge;
      if(cfg.foldWhite!==undefined) this.stampSect.white=!!cfg.foldWhite;
      if(cfg.foldRange!==undefined) this.batchSect.range=!!cfg.foldRange;
      if(cfg.foldText!==undefined){ this.batchSect.text=this.textForce && !!cfg.foldText; } // V2.4.0.70：恢复折叠态与开关联动（开关关则强制收起，杜绝"开关关/区域展开"初始不一致）
      if(cfg.foldMode!==undefined) this.outSect.mode=!!cfg.foldMode;
      if(cfg.foldDpi!==undefined) this.outSect.dpi=!!cfg.foldDpi;
      if(cfg.foldName!==undefined) this.outSect.name=!!cfg.foldName;
      if(cfg.qfzType!==undefined) this.seamType=String(cfg.qfzType);
      if(cfg.maxfgs!==undefined && cfg.maxfgs>0) this.segCount=cfg.maxfgs;
      if(cfg.wzType!==undefined) this.sealPos=['下','上','左','右'][cfg.wzType]||'右';
      if(cfg.wz!==undefined) this.posVal=cfg.wz+'%';
      this._shellLoading=false;
    },
    applyStampParams(p){
      this._shellLoading=true;
      if(p.size!==undefined) this.sealSize=p.size;
      if(p.rotation!==undefined) this.rotation=p.rotation;
      if(p.opacity!==undefined) this.opacity=p.opacity;
      if(p.maxSplit!==undefined) this.segCount=p.maxSplit;
      // V1.1.0.3：骑缝章首/尾页章宽可配置  V1.1.0.4：加载时夹紧到 5~45（防旧配置越界）
      if(p.seamFirstEnabled!==undefined) this.seamFirstEnabled=!!p.seamFirstEnabled;
      if(p.seamFirstRatio!==undefined) this.seamFirstRatio=Math.min(45,Math.max(5,p.seamFirstRatio));
      if(p.seamLastEnabled!==undefined) this.seamLastEnabled=!!p.seamLastEnabled;
      if(p.seamLastRatio!==undefined) this.seamLastRatio=Math.min(45,Math.max(5,p.seamLastRatio));
      if(p.removeWhite!==undefined) this.removeWhite=!!p.removeWhite;
      if(p.tolerance!==undefined) this.tolerance=p.tolerance;
      if(p.randomParams!==undefined) this.randEnabled=!!p.randomParams;
      if(p.randomRange!==undefined) this.rand.angle=p.randomRange;
      if(p.randomOffsetXMm!==undefined) this.rand.h=p.randomOffsetXMm;
      if(p.randomOffsetYMm!==undefined) this.rand.v=p.randomOffsetYMm;
      if(p.textureQuality!==undefined) this.renderEnabled=!!p.textureQuality;
      if(p.textureBrightness!==undefined) this.tex.brightness=p.textureBrightness;
      if(p.textureRadial!==undefined) this.tex.pressure=p.textureRadial;
      if(p.textureSpot!==undefined) this.tex.blob=p.textureSpot;
      if(p.textureBlob!==undefined) this.tex.blobSize=p.textureBlob;
      if(p.textureGradient!==undefined) this.tex.gradient=p.textureGradient;
      if(p.textureCast!==undefined) this.tex.hue=p.textureCast;
      if(p.textureWhite!==undefined) this.tex.white=p.textureWhite;
      if(p.texturePresetIndex!==undefined) this.preset=p.texturePresetIndex;
      /* V1.1.1.0：盖章叠字（随章记忆；老 config.ini 无这些键时保持前端默认值） */
      if(p.textOverlayEnabled!==undefined) this.textOvEnabled=!!p.textOverlayEnabled;
      if(p.textOverlayText!==undefined) this.textOvText=p.textOverlayText||'';
      if(p.textOverlayPos!==undefined) this.textOvPos=String(p.textOverlayPos||0);
      if(p.textOverlayColorArgb!==undefined) this.textOvColor=this.wmArgbToHex?this.wmArgbToHex(p.textOverlayColorArgb):'#C00000';
      if(p.textOverlaySize!==undefined) this.textOvSize=(p.textOverlaySize>=10&&p.textOverlaySize<=100)?p.textOverlaySize:30;
      /* V1.1.1.4：原文浮于章上（随章记忆；老 config.ini 无此键时保持前端默认值关） */
      if(p.stampUnderText!==undefined) this.stampUnderText=!!p.stampUnderText;
      this._shellLoading=false;
    },
    fmtToFront(f){ return {yyyyMMdd:'d8','yyyy-MM-dd':'dash','yyyyMMdd-HHmm':'d8-t','yyyy-MM-dd-HH-mm':'full'}[f]||'d8'; },
    fmtToBack(v){ return {d8:'yyyyMMdd',dash:'yyyy-MM-dd','d8-t':'yyyyMMdd-HHmm',full:'yyyy-MM-dd-HH-mm'}[v]||'yyyyMMdd'; },
    saveUiConfig(){
      if(this._shellLoading || !window.Bridge || !window.Bridge.invoke) return;
      const cfg={
        outputQualityDpi: parseInt(this.dpi)||150,
        outputFormat: (this.outFormatArr&&this.outFormatArr.length)?this.outFormatArr.join(','):'pdf', // V1.0.0.47：输出格式多选（逗号分隔）
        outputNameMark: this.nameMark,
        outputNamePos: this.namePos==='before'?1:0,
        outputNameSeqType: ['num','upper','lower'].indexOf(this.seqType),
        outputNamePad: parseInt(this.seqPad)||1,
        outputNameTs: !!this.useTs,
        outputNameTsFormat: this.fmtToBack(this.tsFormat),
        contextFilterEnabled: !!this.keywordEnabled,
        contextKeywords: this.keywords,
        contextRange: parseInt(this.ctxRange)||10,
        contextMatch: this.matchMode==='all'?1:0,
        contextExcludeSpaces: !!this.ignoreSpace,
        outputDir: this.saveDir,
        outputDirLocked: this.dirLocked?1:0,
        wzType: ['下','上','左','右'].indexOf(this.sealPos),
        // 同上：骑缝章位置百分比允许 0，不能用 || 回落（0 会被吃成 50）
        wz: (this.posVal===null||this.posVal===undefined||this.posVal==='')?50:parseInt(this.posVal),
        qfzType: parseInt(this.seamType)||0,
        maxfgs: parseInt(this.segCount)||20,
        leftPanelWidth: this.leftWidth,
        foldDisp: this.stampSect.disp?1:0, foldRidge: this.stampSect.ridge?1:0, foldWhite: this.stampSect.white?1:0,
        foldRange: this.batchSect.range?1:0, foldText: this.batchSect.text?1:0,
        foldMode: this.outSect.mode?1:0, foldDpi: this.outSect.dpi?1:0, foldName: this.outSect.name?1:0,
      };
      // V2.4.0.80：写盘防抖 200ms（折叠/参数连续变化合并为一次写盘）；pagehide/visibilitychange/关键切换点 flush
      this._uiConfigPending=cfg;
      if(this._uiConfigTimer){ clearTimeout(this._uiConfigTimer); }
      this._uiConfigTimer=setTimeout(()=>{ this._flushUiConfig(); },200);
    },
    _flushUiConfig(){
      if(this._uiConfigTimer){ clearTimeout(this._uiConfigTimer); this._uiConfigTimer=null; }
      if(!this._uiConfigPending){ return; }
      const cfg=this._uiConfigPending; this._uiConfigPending=null;
      if(this._shellLoading || !window.Bridge || !window.Bridge.invoke) return;
      window.Bridge.invoke('SetUiConfig', JSON.stringify(cfg)).catch(()=>{});
    },
    saveStampParams(){
      if(this._shellLoading || !window.Bridge || !window.Bridge.invoke) return;
      const p={
        size: parseInt(this.sealSize)||40,
        rotation: parseInt(this.rotation)||0,
        // 缺陷修复：此前用 parseInt(...)||60 —— 用户把不透明度设为 0（完全透明）时，
        // 0 被当成「假值」回落成 60%，用户设置静默丢失（重启后还是 60%）。
        // 改为显式判空：只有空/非数字才回落默认（默认 100，与 V1.3.0 产品默认一致）。
        opacity: (this.opacity===null||this.opacity===undefined||this.opacity==='')?100:parseInt(this.opacity),
        maxSplit: this._segModified ? (parseInt(this.segCount)||500) : -1,
        // V1.1.0.3：骑缝章首/尾页章宽可配置  V1.1.0.4：默认20，夹紧5~45
        seamFirstEnabled: !!this.seamFirstEnabled,
        seamFirstRatio: Math.min(45,Math.max(5,parseInt(this.seamFirstRatio)||20)),
        seamLastEnabled: !!this.seamLastEnabled,
        seamLastRatio: Math.min(45,Math.max(5,parseInt(this.seamLastRatio)||20)),
        removeWhite: !!this.removeWhite,
        tolerance: parseInt(this.tolerance)||20,
        randomParams: !!this.randEnabled,
        randomRange: this.rand.angle,
        randomOffsetXMm: this.rand.h,
        randomOffsetYMm: this.rand.v,
        textureQuality: !!this.renderEnabled,
        textureBrightness: this.tex.brightness,
        textureRadial: this.tex.pressure,
        textureSpot: this.tex.blob,
        textureBlob: this.tex.blobSize,
        textureGradient: this.tex.gradient,
        textureCast: this.tex.hue,
        textureWhite: this.tex.white,
        texturePresetIndex: this.preset,
        stampUnderText: !!this.stampUnderText, // V1.1.1.4：原文浮于章上（随章记忆）
      };
      // V2.4.0.80：写盘防抖 200ms（滑块拖动/连续调参合并一次写盘，替代 V47 即时写盘；防丢参数靠 flush）
      this._stampParamsPending=p;
      if(this._stampParamsTimer){ clearTimeout(this._stampParamsTimer); }
      this._stampParamsTimer=setTimeout(()=>{ this._flushStampParams(); },200);
    },
    _flushStampParams(){
      if(this._stampParamsTimer){ clearTimeout(this._stampParamsTimer); this._stampParamsTimer=null; }
      if(!this._stampParamsPending){ return; }
      const p=this._stampParamsPending; this._stampParamsPending=null;
      if(this._shellLoading || !window.Bridge || !window.Bridge.invoke) return;
      window.Bridge.invoke('SetStampParams', this.curSeal, JSON.stringify(p)).catch(()=>{});
    },
};
