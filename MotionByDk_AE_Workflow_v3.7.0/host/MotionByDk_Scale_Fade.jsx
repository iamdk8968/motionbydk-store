/**
 * Motion By DK - Center Scale & Fade & macOS Mouse Dock Suite
 * CEP ExtendScript Bridge
 * Author: Motion by DK (@motionbydk)
 * Version: 2.0.0
 * 
 * Provides ExtendScript engines for:
 * 1. Center Scale & Fade (Proximity-based falloff & interpolation)
 * 2. macOS Mouse Dock (Magnification, baseline alignment, procedural dock background)
 */

(function () {
    "use strict";

    var CTRL_LAYER_NAME = "Controller";
    var MOUSE_DOCK_CTRL_NAME = "dock control";
    var BG_NAME = "Dock Background";

    // ------------------------------------------------------------------------
    // UTILITY HELPERS
    // ------------------------------------------------------------------------
    function getActiveComp() {
        var item = app.project ? app.project.activeItem : null;
        if (item && item instanceof CompItem) {
            return item;
        }
        return null;
    }

    function isValidTargetLayer(layer, ignoreList) {
        if (!layer) return false;
        if (layer.name === CTRL_LAYER_NAME) return false;
        if (layer.name === MOUSE_DOCK_CTRL_NAME || layer.name === BG_NAME) return false;
        if (ignoreList) {
            for (var i = 0; i < ignoreList.length; i++) {
                if (layer.name === ignoreList[i]) return false;
            }
        }
        if ((typeof CameraLayer !== 'undefined' && layer instanceof CameraLayer) || 
            (typeof LightLayer !== 'undefined' && layer instanceof LightLayer)) return false;
        if (layer.guideLayer) return false;
        if (layer.locked) return false;
        if (!layer.enabled) return false;
        return true;
    }

    // ------------------------------------------------------------------------
    // CENTER SCALE & FADE EXPRESSIONS & CONTROLS
    // ------------------------------------------------------------------------
    function getScaleExpressionString(cfg) {
        return [
            '// Motion By DK - Center Scale Expression',
            'try {',
            '    var ctrlName = "' + CTRL_LAYER_NAME + '";',
            '    var ctrl = null;',
            '    var hasCtrl = false;',
            '    try {',
            '        ctrl = thisComp.layer(ctrlName);',
            '        if (!ctrl) { try { ctrl = thisComp.layer("Motion By DK Controller"); } catch(e){} }',
            '        if (ctrl && ctrl.active) { hasCtrl = true; }',
            '    } catch (e) {',
            '        hasCtrl = false;',
            '    }',
            '    var enable = ' + (cfg.enableScale ? 'true' : 'false') + ';',
            '    var maxS = ' + cfg.maxScale + ';',
            '    var minS = ' + cfg.minScale + ';',
            '    var maxD = ' + cfg.maxDistance + ';',
            '    var axis = ' + (cfg.axisIndex + 1) + '; // 1:Vert, 2:Horiz, 3:Radial',
            '    var falloff = ' + (cfg.falloffIndex + 1) + '; // 1:Lin, 2:Smooth, 3:Exp',
            '    var interp = ' + (cfg.interpolationIndex + 1) + '; // 1:Lin, 2:EaseIn, 3:EaseOut, 4:EaseInOut',
            '',
            '    if (hasCtrl && ctrl) {',
            '        try { enable = ctrl.effect("Enable Scale")(1).value == 1; } catch(e) {}',
            '        try { maxS = Number(ctrl.effect("Max Scale")(1).value); } catch(e) {}',
            '        try { minS = Number(ctrl.effect("Min Scale")(1).value); } catch(e) {}',
            '        try { maxD = Number(ctrl.effect("Max Distance")(1).value); } catch(e) {}',
            '        try { axis = Number(ctrl.effect("Distance Axis")(1).value); } catch(e) {}',
            '        try { falloff = Number(ctrl.effect("Falloff")(1).value); } catch(e) {}',
            '        try { interp = Number(ctrl.effect("Interpolation")(1).value); } catch(e) {}',
            '    }',
            '',
            '    if (!enable) {',
            '        value;',
            '    } else {',
            '        var p = toComp(anchorPoint);',
            '        var center = [thisComp.width / 2, thisComp.height / 2];',
            '        if (hasCtrl && ctrl) {',
            '            try { center = ctrl.toComp(ctrl.transform.anchorPoint); } catch(e) { try { center = ctrl.toComp([0,0,0]); } catch(e2){} }',
            '        }',
            '        var d = 0;',
            '        if (axis == 1) { d = Math.abs(p[1] - center[1]); }',
            '        else if (axis == 2) { d = Math.abs(p[0] - center[0]); }',
            '        else { d = length(p, center); }',
            '',
            '        var t = maxD > 0 ? Math.min(1, Math.max(0, d / maxD)) : 1;',
            '',
            '        if (falloff == 2) { t = t * t * (3 - 2 * t); }',
            '        else if (falloff == 3) { t = Math.pow(t, 2); }',
            '',
            '        if (interp == 2) { t = Math.pow(t, 2); }',
            '        else if (interp == 3) { t = 1 - Math.pow(1 - t, 2); }',
            '        else if (interp == 4) { t = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2; }',
            '',
            '        var s = maxS + (minS - maxS) * t;',
            '        value.length > 2 ? [s, s, s] : [s, s];',
            '    }',
            '} catch (err) {',
            '    value;',
            '}'
        ].join("\n");
    }

    function getOpacityExpressionString(cfg) {
        return [
            '// Motion By DK - Center Fade Expression',
            'try {',
            '    var ctrlName = "' + CTRL_LAYER_NAME + '";',
            '    var ctrl = null;',
            '    var hasCtrl = false;',
            '    try {',
            '        ctrl = thisComp.layer(ctrlName);',
            '        if (!ctrl) { try { ctrl = thisComp.layer("Motion By DK Controller"); } catch(e){} }',
            '        if (ctrl && ctrl.active) { hasCtrl = true; }',
            '    } catch (e) {',
            '        hasCtrl = false;',
            '    }',
            '    var enable = ' + (cfg.enableOpacity ? 'true' : 'false') + ';',
            '    var fadeD = ' + cfg.fadeDistance + ';',
            '    var minOp = ' + cfg.minOpacity + ';',
            '    var axis = ' + (cfg.axisIndex + 1) + ';',
            '    var falloff = ' + (cfg.falloffIndex + 1) + ';',
            '    var interp = ' + (cfg.interpolationIndex + 1) + ';',
            '',
            '    if (hasCtrl && ctrl) {',
            '        try { enable = ctrl.effect("Enable Opacity")(1).value == 1; } catch(e) {}',
            '        try { fadeD = Number(ctrl.effect("Fade Distance")(1).value); } catch(e) {}',
            '        try { minOp = Number(ctrl.effect("Minimum Opacity")(1).value); } catch(e) {}',
            '        try { axis = Number(ctrl.effect("Distance Axis")(1).value); } catch(e) {}',
            '        try { falloff = Number(ctrl.effect("Falloff")(1).value); } catch(e) {}',
            '        try { interp = Number(ctrl.effect("Interpolation")(1).value); } catch(e) {}',
            '    }',
            '',
            '    if (!enable) {',
            '        value;',
            '    } else {',
            '        var p = toComp(anchorPoint);',
            '        var center = [thisComp.width / 2, thisComp.height / 2];',
            '        if (hasCtrl && ctrl) {',
            '            try { center = ctrl.toComp(ctrl.transform.anchorPoint); } catch(e) { try { center = ctrl.toComp([0,0,0]); } catch(e2){} }',
            '        }',
            '        var d = 0;',
            '        if (axis == 1) { d = Math.abs(p[1] - center[1]); }',
            '        else if (axis == 2) { d = Math.abs(p[0] - center[0]); }',
            '        else { d = length(p, center); }',
            '',
            '        var t = fadeD > 0 ? Math.min(1, Math.max(0, d / fadeD)) : 1;',
            '',
            '        if (falloff == 2) { t = t * t * (3 - 2 * t); }',
            '        else if (falloff == 3) { t = Math.pow(t, 2); }',
            '',
            '        if (interp == 2) { t = Math.pow(t, 2); }',
            '        else if (interp == 3) { t = 1 - Math.pow(1 - t, 2); }',
            '        else if (interp == 4) { t = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2; }',
            '',
            '        100 + (minOp - 100) * t;',
            '    }',
            '} catch (err) {',
            '    value;',
            '}'
        ].join("\n");
    }

    function getOrCreateScaleFadeController(comp, cfg) {
        if (!comp) return null;
        var ctrlLayer = null;
        try { ctrlLayer = comp.layer(CTRL_LAYER_NAME); } catch(e){}
        if (!ctrlLayer) {
            ctrlLayer = comp.layers.addNull();
            ctrlLayer.name = CTRL_LAYER_NAME;
            ctrlLayer.guideLayer = true;
            ctrlLayer.label = 13;
        }

        var p = ctrlLayer.property("ADBE Effect Parade");

        function getOrAdd(name, matchName) {
            var fx = p.property(name);
            if (!fx) {
                fx = p.addProperty(matchName);
                fx.name = name;
            }
            return fx;
        }

        getOrAdd("Enable Scale", "ADBE Checkbox Control").property(1).setValue(cfg.enableScale ? 1 : 0);
        getOrAdd("Enable Opacity", "ADBE Checkbox Control").property(1).setValue(cfg.enableOpacity ? 1 : 0);
        getOrAdd("Max Scale", "ADBE Slider Control").property(1).setValue(cfg.maxScale !== undefined ? cfg.maxScale : 120);
        getOrAdd("Min Scale", "ADBE Slider Control").property(1).setValue(cfg.minScale !== undefined ? cfg.minScale : 60);
        getOrAdd("Max Distance", "ADBE Slider Control").property(1).setValue(cfg.maxDistance !== undefined ? cfg.maxDistance : 500);
        getOrAdd("Fade Distance", "ADBE Slider Control").property(1).setValue(cfg.fadeDistance !== undefined ? cfg.fadeDistance : 500);
        getOrAdd("Minimum Opacity", "ADBE Slider Control").property(1).setValue(cfg.minOpacity !== undefined ? cfg.minOpacity : 0);
        getOrAdd("Distance Axis", "ADBE Slider Control").property(1).setValue((cfg.axisIndex !== undefined ? cfg.axisIndex : 2) + 1);
        getOrAdd("Falloff", "ADBE Slider Control").property(1).setValue((cfg.falloffIndex !== undefined ? cfg.falloffIndex : 0) + 1);
        getOrAdd("Interpolation", "ADBE Slider Control").property(1).setValue((cfg.interpolationIndex !== undefined ? cfg.interpolationIndex : 0) + 1);

        return ctrlLayer;
    }

    function updateScaleFadeControllerValues(comp, cfg) {
        if (!comp) return;
        var ctrl = null;
        try { ctrl = comp.layer(CTRL_LAYER_NAME); } catch(e){}
        if (!ctrl) return;

        var p = ctrl.property("ADBE Effect Parade");
        function setFx(name, val) {
            var fx = p.property(name);
            if (fx) fx.property(1).setValue(val);
        }

        if (cfg.enableScale !== undefined) setFx("Enable Scale", cfg.enableScale ? 1 : 0);
        if (cfg.enableOpacity !== undefined) setFx("Enable Opacity", cfg.enableOpacity ? 1 : 0);
        if (cfg.maxScale !== undefined) setFx("Max Scale", cfg.maxScale);
        if (cfg.minScale !== undefined) setFx("Min Scale", cfg.minScale);
        if (cfg.maxDistance !== undefined) setFx("Max Distance", cfg.maxDistance);
        if (cfg.fadeDistance !== undefined) setFx("Fade Distance", cfg.fadeDistance);
        if (cfg.minOpacity !== undefined) setFx("Minimum Opacity", cfg.minOpacity);
        if (cfg.axisIndex !== undefined) setFx("Distance Axis", cfg.axisIndex + 1);
        if (cfg.falloffIndex !== undefined) setFx("Falloff", cfg.falloffIndex + 1);
        if (cfg.interpolationIndex !== undefined) setFx("Interpolation", cfg.interpolationIndex + 1);
    }

    // ------------------------------------------------------------------------
    // MOUSE DOCK EXPRESSIONS & CONTROLS
    // ------------------------------------------------------------------------
    function getMouseDockScaleExpression(layerNamesStr, myIndex) {
        return [
            '// Motion By DK - Mac Mouse Dock Scale',
            'try {',
            '    var ctrl = null;',
            '    try { ctrl = thisComp.layer("dock control"); } catch(e){}',
            '    if (!ctrl) { try { ctrl = thisComp.layer("Dock Control"); } catch(e){} }',
            '    if (!ctrl || ctrl.effect("Enable Mouse Dock")("Checkbox").value == 0) { value; } else {',
            '        var baseScale = ctrl.effect("Icon Scale (%)")("Slider").value;',
            '        var mag = ctrl.effect("Magnification (%)")("Slider").value;',
            '        var magRange = ctrl.effect("Magnification Range")("Slider").value;',
            '        var spacing = ctrl.effect("Icon Spacing (px)")("Slider").value;',
            '        var startX = ctrl.effect("Initial Center X")("Slider").value;',
            '',
            '        var dockLayers = ' + layerNamesStr + ';',
            '        var myIdx = ' + myIndex + ';',
            '        var totalBaseW = 0;',
            '        var baseCenterXs = [];',
            '',
            '        for (var i = 0; i < dockLayers.length; i++) {',
            '            var L = thisComp.layer(dockLayers[i]);',
            '            var sR = L.sourceRectAtTime(time, false);',
            '            var w = sR.width * (baseScale / 100);',
            '            baseCenterXs.push(totalBaseW + w / 2);',
            '            totalBaseW += w;',
            '        }',
            '        totalBaseW += spacing * (dockLayers.length - 1);',
            '        var groupBaseLeft = startX - (totalBaseW / 2);',
            '',
            '        for (var i = 0; i < dockLayers.length; i++) {',
            '            baseCenterXs[i] += groupBaseLeft + i * spacing;',
            '        }',
            '',
            '        var mousePos = ctrl.toComp(ctrl.anchorPoint);',
            '        var mouseX = mousePos[0];',
            '        var myBaseX = baseCenterXs[myIdx];',
            '        var dist = Math.abs(mouseX - myBaseX);',
            '',
            '        var factor = 0;',
            '        if (magRange > 0 && dist < magRange) {',
            '            var norm = dist / magRange;',
            '            factor = 0.5 * (1 + Math.cos(norm * Math.PI));',
            '        }',
            '',
            '        var finalScale = baseScale + (mag * factor);',
            '        [finalScale, finalScale];',
            '    }',
            '} catch(e) { value; }'
        ].join("\n");
    }

    function getMouseDockPositionExpression(layerNamesStr, myIndex) {
        return [
            '// Motion By DK - Mac Mouse Dock Position',
            'try {',
            '    var ctrl = null;',
            '    try { ctrl = thisComp.layer("dock control"); } catch(e){}',
            '    if (!ctrl) { try { ctrl = thisComp.layer("Dock Control"); } catch(e){} }',
            '    if (!ctrl || ctrl.effect("Enable Mouse Dock")("Checkbox").value == 0) { value; } else {',
            '        var baseScale = ctrl.effect("Icon Scale (%)")("Slider").value;',
            '        var mag = ctrl.effect("Magnification (%)")("Slider").value;',
            '        var magRange = ctrl.effect("Magnification Range")("Slider").value;',
            '        var spacing = ctrl.effect("Icon Spacing (px)")("Slider").value;',
            '        var vertPos = ctrl.effect("Vertical Position")("Slider").value;',
            '        var startX = ctrl.effect("Initial Center X")("Slider").value;',
            '        var baseLineY = ctrl.effect("Initial Baseline Y")("Slider").value;',
            '',
            '        var dockLayers = ' + layerNamesStr + ';',
            '        var myIdx = ' + myIndex + ';',
            '        var totalBaseW = 0;',
            '        var baseCenterXs = [];',
            '        var sourceWidths = [];',
            '',
            '        for (var i = 0; i < dockLayers.length; i++) {',
            '            var L = thisComp.layer(dockLayers[i]);',
            '            var sR = L.sourceRectAtTime(time, false);',
            '            var w0 = sR.width * (baseScale / 100);',
            '            sourceWidths.push(sR.width);',
            '            baseCenterXs.push(totalBaseW + w0 / 2);',
            '            totalBaseW += w0;',
            '        }',
            '        totalBaseW += spacing * (dockLayers.length - 1);',
            '        var groupBaseLeft = startX - (totalBaseW / 2);',
            '',
            '        var mousePos = ctrl.toComp(ctrl.anchorPoint);',
            '        var mouseX = mousePos[0];',
            '        var totalMagW = 0;',
            '        var myOffset = 0;',
            '',
            '        for (var i = 0; i < dockLayers.length; i++) {',
            '            var bX = groupBaseLeft + baseCenterXs[i] + i * spacing;',
            '            var dist = Math.abs(mouseX - bX);',
            '            var factor = 0;',
            '            if (magRange > 0 && dist < magRange) {',
            '                var norm = dist / magRange;',
            '                factor = 0.5 * (1 + Math.cos(norm * Math.PI));',
            '            }',
            '            var iconScale = baseScale + mag * factor;',
            '            var magW = sourceWidths[i] * (iconScale / 100);',
            '            if (i < myIdx) {',
            '                myOffset += magW + spacing;',
            '            } else if (i === myIdx) {',
            '                myOffset += magW / 2;',
            '            }',
            '            totalMagW += magW;',
            '        }',
            '        totalMagW += spacing * (dockLayers.length - 1);',
            '',
            '        var finalX = startX - (totalMagW / 2) + myOffset;',
            '',
            '        var mySR = sourceRectAtTime(time, false);',
            '        var distFromAnchorToBottom = mySR.top + mySR.height - anchorPoint[1];',
            '        var finalY = baseLineY + vertPos - (distFromAnchorToBottom * (scale[1] / 100));',
            '',
            '        [finalX, finalY];',
            '    }',
            '} catch(e) { value; }'
        ].join("\n");
    }

    function getBackgroundSizeExpression(layerNamesStr) {
        return [
            '// Motion By DK - Mac Dock Background Size',
            'try {',
            '    var bgEnable = effect("Enable Dock Background")("Checkbox").value;',
            '    if (bgEnable == 0) { [0, 0]; } else {',
            '        var dockLayers = ' + layerNamesStr + ';',
            '        var minX = 999999;',
            '        var maxX = -999999;',
            '        for (var i = 0; i < dockLayers.length; i++) {',
            '            var L = thisComp.layer(dockLayers[i]);',
            '            if (L && L.active) {',
            '                var sR = L.sourceRectAtTime(time, false);',
            '                var L_left = L.toComp([sR.left, 0])[0];',
            '                var L_right = L.toComp([sR.left + sR.width, 0])[0];',
            '                if (L_left < minX) minX = L_left;',
            '                if (L_right > maxX) maxX = L_right;',
            '            }',
            '        }',
            '        var pad = effect("Horizontal Padding (px)")("Slider").value;',
            '        var w = (minX === 999999) ? 0 : (maxX - minX) + (pad * 2);',
            '        var h = effect("Background Height (px)")("Slider").value;',
            '        [w, h];',
            '    }',
            '} catch(e) { value; }'
        ].join("\n");
    }

    function getBackgroundPositionExpression(layerNamesStr) {
        return [
            '// Motion By DK - Mac Dock Background Position',
            'try {',
            '    var dockLayers = ' + layerNamesStr + ';',
            '    var minX = 999999;',
            '    var maxX = -999999;',
            '    for (var i = 0; i < dockLayers.length; i++) {',
            '        var L = thisComp.layer(dockLayers[i]);',
            '        if (L && L.active) {',
            '            var sR = L.sourceRectAtTime(time, false);',
            '            var L_left = L.toComp([sR.left, 0])[0];',
            '            var L_right = L.toComp([sR.left + sR.width, 0])[0];',
            '            if (L_left < minX) minX = L_left;',
            '            if (L_right > maxX) maxX = L_right;',
            '        }',
            '    }',
            '    var centerX = (minX === 999999) ? value[0] : (minX + maxX) / 2;',
            '',
            '    var ctrl = null;',
            '    try { ctrl = thisComp.layer("dock control"); } catch(e){}',
            '    if (!ctrl) { try { ctrl = thisComp.layer("Dock Control"); } catch(e){} }',
            '    var baseLineY = (ctrl && ctrl.effect("Initial Baseline Y")) ? ctrl.effect("Initial Baseline Y")("Slider").value : value[1];',
            '    var vertPos = (ctrl && ctrl.effect("Vertical Position")) ? ctrl.effect("Vertical Position")("Slider").value : 0;',
            '    var h = effect("Background Height (px)")("Slider").value;',
            '',
            '    var centerY = baseLineY + vertPos - (h / 2) + 10;',
            '    [centerX, centerY];',
            '} catch(e) { value; }'
        ].join("\n");
    }

    function createOrUpdateMouseDockController(comp, startX, startY, cfg) {
        if (!comp) return null;
        var ctrlLayer = null;
        try { ctrlLayer = comp.layer(MOUSE_DOCK_CTRL_NAME); } catch(e){}
        if (!ctrlLayer) { try { ctrlLayer = comp.layer("Dock Control"); } catch(e){} }

        if (!ctrlLayer) {
            ctrlLayer = comp.layers.addNull();
            ctrlLayer.name = MOUSE_DOCK_CTRL_NAME;
            ctrlLayer.guideLayer = true;
            ctrlLayer.label = 11;
            ctrlLayer.property("ADBE Transform Group").property("ADBE Position").setValue([startX, startY]);
        }

        var p = ctrlLayer.property("ADBE Effect Parade");
        function getOrAdd(name, matchName) {
            var fx = p.property(name);
            if (!fx) {
                fx = p.addProperty(matchName);
                fx.name = name;
            }
            return fx;
        }

        getOrAdd("Enable Mouse Dock", "ADBE Checkbox Control").property(1).setValue(1);
        getOrAdd("Icon Spacing (px)", "ADBE Slider Control").property(1).setValue(cfg.dockSpacing !== undefined ? cfg.dockSpacing : 40);
        getOrAdd("Icon Scale (%)", "ADBE Slider Control").property(1).setValue(cfg.dockScale !== undefined ? cfg.dockScale : 100);
        getOrAdd("Vertical Position", "ADBE Slider Control").property(1).setValue(cfg.dockVertPos !== undefined ? cfg.dockVertPos : 0);
        getOrAdd("Magnification (%)", "ADBE Slider Control").property(1).setValue(cfg.dockMag !== undefined ? cfg.dockMag : 100);
        getOrAdd("Magnification Range", "ADBE Slider Control").property(1).setValue(cfg.dockMagRange !== undefined ? cfg.dockMagRange : 300);
        
        if (startX !== undefined) getOrAdd("Initial Center X", "ADBE Slider Control").property(1).setValue(startX);
        if (startY !== undefined) getOrAdd("Initial Baseline Y", "ADBE Slider Control").property(1).setValue(startY);

        return ctrlLayer;
    }

    function createOrUpdateDockBackground(comp, layerNamesStr, cfg) {
        if (!comp) return null;
        var bgLayer = null;
        try { bgLayer = comp.layer(BG_NAME); } catch(e){}

        if (!bgLayer) {
            bgLayer = comp.layers.addShape();
            bgLayer.name = BG_NAME;
            bgLayer.moveToEnd();

            var shapeGroup = bgLayer.property("ADBE Root Vectors Group");
            var rect = shapeGroup.addProperty("ADBE Vector Shape - Rect");
            var fill = shapeGroup.addProperty("ADBE Vector Graphic - Fill");
            fill.property("ADBE Vector Fill Color").setValue([0.12, 0.12, 0.14, 1]);
        }

        var p = bgLayer.property("ADBE Effect Parade");
        function getOrAdd(name, matchName) {
            var fx = p.property(name);
            if (!fx) {
                fx = p.addProperty(matchName);
                fx.name = name;
            }
            return fx;
        }

        getOrAdd("Enable Dock Background", "ADBE Checkbox Control").property(1).setValue(cfg.dockEnableBg ? 1 : 0);
        getOrAdd("Background Height (px)", "ADBE Slider Control").property(1).setValue(cfg.dockBgHeight !== undefined ? cfg.dockBgHeight : 80);
        getOrAdd("Corner Roundness (px)", "ADBE Slider Control").property(1).setValue(cfg.dockBgRound !== undefined ? cfg.dockBgRound : 40);
        getOrAdd("Background Opacity (%)", "ADBE Slider Control").property(1).setValue(cfg.dockBgOp !== undefined ? cfg.dockBgOp : 90);
        getOrAdd("Horizontal Padding (px)", "ADBE Slider Control").property(1).setValue(cfg.dockBgPad !== undefined ? cfg.dockBgPad : 20);

        try {
            bgLayer.property("ADBE Transform Group").property("ADBE Opacity").expression = 'effect("Background Opacity (%)")("Slider");';
            var rect = bgLayer.property("ADBE Root Vectors Group").property(1);
            rect.property("ADBE Vector Rect Roundness").expression = 'effect("Corner Roundness (px)")("Slider");';
            rect.property("ADBE Vector Rect Size").expression = getBackgroundSizeExpression(layerNamesStr);
            bgLayer.property("ADBE Transform Group").property("ADBE Position").expression = getBackgroundPositionExpression(layerNamesStr);
        } catch(e) {}

        return bgLayer;
    }

    // ========================================================================
    // PUBLIC EXTENDSCRIPT INTERFACES
    // ========================================================================

    // 1. CENTER SCALE & FADE
    $._MDK_SCALEFADE = {
        apply: function (paramsJson) {
            var comp = getActiveComp();
            if (!comp) return "ERROR: No active composition found.";

            var cfg = {};
            try {
                if (typeof paramsJson === "string") cfg = eval("(" + paramsJson + ")");
                else if (typeof paramsJson === "object") cfg = paramsJson;
            } catch(e) { cfg = {}; }

            var targets = [];
            for (var j = 0; j < comp.selectedLayers.length; j++) {
                var ly = comp.selectedLayers[j];
                if (isValidTargetLayer(ly)) targets.push(ly);
            }

            if (targets.length === 0) {
                return "ERROR: Please select layer(s) in active comp.";
            }

            app.beginUndoGroup("Apply Center Scale & Fade – MotionByDk");
            try {
                getOrCreateScaleFadeController(comp, cfg);
                updateScaleFadeControllerValues(comp, cfg);

                var scaleExpr = getScaleExpressionString(cfg);
                var opacityExpr = getOpacityExpressionString(cfg);

                var count = 0;
                for (var k = 0; k < targets.length; k++) {
                    var layer = targets[k];
                    var transform = layer.property("ADBE Transform Group");
                    if (transform) {
                        if (cfg.enableScale && transform.property("ADBE Scale")) {
                            transform.property("ADBE Scale").expression = scaleExpr;
                        }
                        if (cfg.enableOpacity && transform.property("ADBE Opacity")) {
                            transform.property("ADBE Opacity").expression = opacityExpr;
                        }
                        count++;
                    }
                }
                app.endUndoGroup();
                app.redraw();
                return "SUCCESS:" + count;
            } catch (err) {
                app.endUndoGroup();
                return "ERROR: " + err.toString();
            }
        },

        update: function (paramsJson) {
            var comp = getActiveComp();
            if (!comp) return "NO_COMP";

            var cfg = {};
            try {
                if (typeof paramsJson === "string") cfg = eval("(" + paramsJson + ")");
                else if (typeof paramsJson === "object") cfg = paramsJson;
            } catch(e) { cfg = {}; }

            var ctrl = null;
            try { ctrl = comp.layer(CTRL_LAYER_NAME); } catch(e){}
            if (!ctrl) return "NO_CONTROLLER";

            var isLive = !!cfg.isLivePreview;
            if (!isLive) app.beginUndoGroup("Update Center Scale & Fade – MotionByDk");
            try {
                updateScaleFadeControllerValues(comp, cfg);
                if (!isLive) app.endUndoGroup();
                app.redraw();
                return "SUCCESS";
            } catch(err) {
                if (!isLive) app.endUndoGroup();
                return "ERROR: " + err.toString();
            }
        },

        clear: function () {
            var comp = getActiveComp();
            if (!comp) return "ERROR: No active composition.";

            var targets = comp.selectedLayers;
            if (targets.length === 0) return "ERROR: Select layer(s) to clear expressions.";

            app.beginUndoGroup("Clear Center Scale & Fade – MotionByDk");
            var count = 0;
            try {
                for (var i = 0; i < targets.length; i++) {
                    var layer = targets[i];
                    if (!isValidTargetLayer(layer)) continue;

                    var transform = layer.property("ADBE Transform Group");
                    if (transform) {
                        var scaleProp = transform.property("ADBE Scale");
                        if (scaleProp && scaleProp.expressionEnabled && scaleProp.expression.indexOf("Motion By DK") !== -1) {
                            scaleProp.expression = "";
                            scaleProp.setValue([100, 100]);
                        }
                        var opProp = transform.property("ADBE Opacity");
                        if (opProp && opProp.expressionEnabled && opProp.expression.indexOf("Motion By DK") !== -1) {
                            opProp.expression = "";
                            opProp.setValue(100);
                        }
                        count++;
                    }
                }
                app.endUndoGroup();
                app.redraw();
                return "SUCCESS:" + count;
            } catch(err) {
                app.endUndoGroup();
                return "ERROR: " + err.toString();
            }
        },

        deleteController: function () {
            var comp = getActiveComp();
            if (!comp) return "ERROR: No active composition.";
            var ctrl = null;
            try { ctrl = comp.layer(CTRL_LAYER_NAME); } catch(e){}
            if (!ctrl) return "NOT_FOUND";

            app.beginUndoGroup("Delete Controller – MotionByDk");
            try {
                ctrl.remove();
                app.endUndoGroup();
                return "SUCCESS";
            } catch(err) {
                app.endUndoGroup();
                return "ERROR: " + err.toString();
            }
        }
    };

    // 2. MOUSE DOCK
    $._MDK_MOUSEDOCK = {
        apply: function (paramsJson) {
            var comp = getActiveComp();
            if (!comp) return "ERROR: No active composition found.";

            var cfg = {};
            try {
                if (typeof paramsJson === "string") cfg = eval("(" + paramsJson + ")");
                else if (typeof paramsJson === "object") cfg = paramsJson;
            } catch(e) { cfg = {}; }

            var targets = [];
            for (var j = 0; j < comp.selectedLayers.length; j++) {
                var ly = comp.selectedLayers[j];
                if (isValidTargetLayer(ly)) targets.push(ly);
            }

            if (targets.length === 0) {
                return "ERROR: Please select icon layer(s) for Mouse Dock.";
            }

            targets.sort(function(a, b) { return a.index - b.index; });

            var sumX = 0;
            var maxBottom = -99999;
            var layerNamesArray = [];

            for (var i = 0; i < targets.length; i++) {
                var t = targets[i];
                var p = t.property("ADBE Transform Group").property("ADBE Position").value;
                sumX += p[0];

                var sR = t.sourceRectAtTime(comp.time, false);
                var bottomY = p[1] - t.property("ADBE Transform Group").property("ADBE Anchor Point").value[1] + sR.top + sR.height;
                if (bottomY > maxBottom) maxBottom = bottomY;

                var safeName = t.name.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
                layerNamesArray.push('"' + safeName + '"');
            }
            var avgX = sumX / targets.length;
            var layerNamesStr = "[" + layerNamesArray.join(",") + "]";

            app.beginUndoGroup("Apply Mouse Dock – MotionByDk");
            try {
                createOrUpdateMouseDockController(comp, avgX, maxBottom, cfg);
                if (cfg.dockEnableBg) {
                    createOrUpdateDockBackground(comp, layerNamesStr, cfg);
                }

                var count = 0;
                for (var k = 0; k < targets.length; k++) {
                    var layer = targets[k];
                    var transform = layer.property("ADBE Transform Group");
                    if (transform) {
                        if (transform.property("ADBE Scale")) {
                            transform.property("ADBE Scale").expression = getMouseDockScaleExpression(layerNamesStr, k);
                        }
                        if (transform.property("ADBE Position")) {
                            transform.property("ADBE Position").expression = getMouseDockPositionExpression(layerNamesStr, k);
                        }
                        count++;
                    }
                }
                app.endUndoGroup();
                app.redraw();
                return "SUCCESS:" + count;
            } catch (err) {
                app.endUndoGroup();
                return "ERROR: " + err.toString();
            }
        },

        update: function (paramsJson) {
            var comp = getActiveComp();
            if (!comp) return "NO_COMP";

            var cfg = {};
            try {
                if (typeof paramsJson === "string") cfg = eval("(" + paramsJson + ")");
                else if (typeof paramsJson === "object") cfg = paramsJson;
            } catch(e) { cfg = {}; }

            var ctrl = null;
            try { ctrl = comp.layer(MOUSE_DOCK_CTRL_NAME); } catch(e){}
            if (!ctrl) { try { ctrl = comp.layer("Dock Control"); } catch(e){} }
            if (!ctrl) return "NO_CONTROLLER";

            var isLive = !!cfg.isLivePreview;
            if (!isLive) app.beginUndoGroup("Update Mouse Dock – MotionByDk");
            try {
                var p = ctrl.property("ADBE Effect Parade");
                function setFx(name, val) {
                    var fx = p.property(name);
                    if (fx) fx.property(1).setValue(val);
                }
                if (cfg.dockSpacing !== undefined) setFx("Icon Spacing (px)", cfg.dockSpacing);
                if (cfg.dockScale !== undefined) setFx("Icon Scale (%)", cfg.dockScale);
                if (cfg.dockVertPos !== undefined) setFx("Vertical Position", cfg.dockVertPos);
                if (cfg.dockMag !== undefined) setFx("Magnification (%)", cfg.dockMag);
                if (cfg.dockMagRange !== undefined) setFx("Magnification Range", cfg.dockMagRange);

                var bgLayer = null;
                try { bgLayer = comp.layer(BG_NAME); } catch(e){}
                if (bgLayer) {
                    var bgP = bgLayer.property("ADBE Effect Parade");
                    function setBgFx(name, val) {
                        var fx = bgP.property(name);
                        if (fx) fx.property(1).setValue(val);
                    }
                    if (cfg.dockEnableBg !== undefined) setBgFx("Enable Dock Background", cfg.dockEnableBg ? 1 : 0);
                    if (cfg.dockBgHeight !== undefined) setBgFx("Background Height (px)", cfg.dockBgHeight);
                    if (cfg.dockBgRound !== undefined) setBgFx("Corner Roundness (px)", cfg.dockBgRound);
                    if (cfg.dockBgOp !== undefined) setBgFx("Background Opacity (%)", cfg.dockBgOp);
                    if (cfg.dockBgPad !== undefined) setBgFx("Horizontal Padding (px)", cfg.dockBgPad);
                }

                if (!isLive) app.endUndoGroup();
                app.redraw();
                return "SUCCESS";
            } catch (err) {
                if (!isLive) app.endUndoGroup();
                return "ERROR: " + err.toString();
            }
        },

        clear: function () {
            var comp = getActiveComp();
            if (!comp) return "ERROR: No active composition.";

            var targets = comp.selectedLayers;
            if (targets.length === 0) return "ERROR: Select icon layers to clear Mouse Dock.";

            app.beginUndoGroup("Clear Mouse Dock – MotionByDk");
            var count = 0;
            try {
                for (var i = 0; i < targets.length; i++) {
                    var layer = targets[i];
                    if (!isValidTargetLayer(layer)) continue;

                    var transform = layer.property("ADBE Transform Group");
                    if (transform) {
                        var scaleProp = transform.property("ADBE Scale");
                        if (scaleProp && scaleProp.expressionEnabled && scaleProp.expression.indexOf("Mouse Dock") !== -1) {
                            scaleProp.expression = "";
                            scaleProp.setValue([100, 100]);
                        }
                        var posProp = transform.property("ADBE Position");
                        if (posProp && posProp.expressionEnabled && posProp.expression.indexOf("Mouse Dock") !== -1) {
                            posProp.expression = "";
                        }
                        count++;
                    }
                }

                var bgLayer = null;
                try { bgLayer = comp.layer(BG_NAME); } catch(e){}
                if (bgLayer) {
                    try { bgLayer.remove(); } catch(e){}
                }

                app.endUndoGroup();
                app.redraw();
                return "SUCCESS:" + count;
            } catch(err) {
                app.endUndoGroup();
                return "ERROR: " + err.toString();
            }
        },

        deleteController: function () {
            var comp = getActiveComp();
            if (!comp) return "ERROR: No active composition.";
            var ctrl = null;
            try { ctrl = comp.layer(MOUSE_DOCK_CTRL_NAME); } catch(e){}
            if (!ctrl) { try { ctrl = comp.layer("Dock Control"); } catch(e){} }
            if (!ctrl) return "NOT_FOUND";

            app.beginUndoGroup("Delete Mouse Dock Controller – MotionByDk");
            try {
                ctrl.remove();
                var bgLayer = null;
                try { bgLayer = comp.layer(BG_NAME); } catch(e){}
                if (bgLayer) { try { bgLayer.remove(); } catch(e2){} }
                app.endUndoGroup();
                return "SUCCESS";
            } catch(err) {
                app.endUndoGroup();
                return "ERROR: " + err.toString();
            }
        }
    };

})();
