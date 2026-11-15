/**
 * MotionByDk Pro Features - ExtendScript Engine
 * Author: MotionByDk (Dhananjay K.)
 * Features:
 *   - Keyframe Temporal Ease Capture & Paste (EaseCopy)
 *   - Keyframe Timing Inversion (Reverse Animation)
 *   - Active Layer/Comp Diagnostics
 */

(function() {
    if (typeof $._MDK_PRO !== "undefined") return;

    var _mdkPro = {};
    var _clipboardEase = null;

    function _getActiveComp() {
        var comp = app.project ? app.project.activeItem : null;
        if (comp && comp instanceof CompItem) return comp;
        return null;
    }

    function _getSelectedKeyProperties(comp) {
        var out = [];
        if (!comp) return out;
        var selLayers = comp.selectedLayers;
        for (var i = 0; i < selLayers.length; i++) {
            var layer = selLayers[i];
            _walkProps(layer, function(p) {
                try {
                    if (p.numKeys > 0 && p.selectedKeys && p.selectedKeys.length > 0) {
                        out.push(p);
                    }
                } catch(e) {}
            });
        }
        return out;
    }

    function _walkProps(container, callback) {
        try {
            var n = container.numProperties;
            for (var i = 1; i <= n; i++) {
                var prop = container.property(i);
                if (prop.propertyType === PropertyType.PROPERTY) {
                    callback(prop);
                } else if (prop.propertyType === PropertyType.INDEXED_GROUP || prop.propertyType === PropertyType.NAMED_GROUP) {
                    _walkProps(prop, callback);
                }
            }
        } catch(e) {}
    }

    // 1. CAPTURE EASE FROM FIRST SELECTED KEYFRAME
    _mdkPro.copyEase = function() {
        try {
            var comp = _getActiveComp();
            if (!comp) return JSON.stringify({ ok: false, error: "Please open an active composition." });
            
            var props = _getSelectedKeyProperties(comp);
            if (!props.length) return JSON.stringify({ ok: false, error: "Please select at least one keyframe in the timeline." });

            var prop = props[0];
            var keys = prop.selectedKeys;
            if (!keys || !keys.length) return JSON.stringify({ ok: false, error: "No keyframe selected." });

            var keyIndex = keys[0];
            var inEase = prop.keyInTemporalEase(keyIndex);
            var outEase = prop.keyOutTemporalEase(keyIndex);
            var inInterp = prop.keyInInterpolationType(keyIndex);
            var outInterp = prop.keyOutInterpolationType(keyIndex);

            var packedIn = [];
            for (var i = 0; i < inEase.length; i++) {
                packedIn.push({ speed: inEase[i].speed, influence: inEase[i].influence });
            }

            var packedOut = [];
            for (var j = 0; j < outEase.length; j++) {
                packedOut.push({ speed: outEase[j].speed, influence: outEase[j].influence });
            }

            _clipboardEase = {
                propName: prop.name,
                inEase: packedIn,
                outEase: packedOut,
                inInterp: inInterp,
                outInterp: outInterp
            };

            var avgInInf = packedIn.length ? packedIn[0].influence : 33;
            var avgOutInf = packedOut.length ? packedOut[0].influence : 33;

            return JSON.stringify({
                ok: true,
                count: 1,
                prop: prop.name,
                inInfluence: Math.round(avgInInf),
                outInfluence: Math.round(avgOutInf),
                msg: "Ease copied from keyframe (" + prop.name + ")"
            });
        } catch(err) {
            return JSON.stringify({ ok: false, error: "Copy Ease Error: " + err.toString() });
        }
    };

    // 2. PASTE EASE TO ALL CURRENTLY SELECTED KEYFRAMES
    _mdkPro.pasteEase = function(continuous) {
        try {
            if (!_clipboardEase) {
                return JSON.stringify({ ok: false, error: "Clipboard empty. Please copy an ease first!" });
            }

            var comp = _getActiveComp();
            if (!comp) return JSON.stringify({ ok: false, error: "Please open an active composition." });

            var props = _getSelectedKeyProperties(comp);
            if (!props.length) return JSON.stringify({ ok: false, error: "Please select target keyframes to paste ease onto." });

            var changed = 0;
            app.beginUndoGroup("MotionByDk Paste Ease");

            for (var p = 0; p < props.length; p++) {
                var prop = props[p];
                var keys = prop.selectedKeys;
                if (!keys || !keys.length) continue;

                var isSpatial = false;
                try { isSpatial = !!prop.isSpatial; } catch(e0) {}

                for (var k = 0; k < keys.length; k++) {
                    var keyIndex = keys[k];
                    try {
                        var curIn = prop.keyInTemporalEase(keyIndex);
                        var curOut = prop.keyOutTemporalEase(keyIndex);
                        var dim = curIn ? curIn.length : 1;

                        var newIn = [];
                        for (var d1 = 0; d1 < dim; d1++) {
                            var srcIn = _clipboardEase.inEase[Math.min(d1, _clipboardEase.inEase.length - 1)];
                            newIn.push(new KeyframeEase(srcIn.speed, srcIn.influence));
                        }

                        var newOut = [];
                        for (var d2 = 0; d2 < dim; d2++) {
                            var srcOut = _clipboardEase.outEase[Math.min(d2, _clipboardEase.outEase.length - 1)];
                            newOut.push(new KeyframeEase(srcOut.speed, srcOut.influence));
                        }

                        if (_clipboardEase.inInterp !== null && _clipboardEase.outInterp !== null) {
                            try { prop.setInterpolationTypeAtKey(keyIndex, _clipboardEase.inInterp, _clipboardEase.outInterp); } catch(e1) {}
                        }

                        prop.setTemporalAutoBezierAtKey(keyIndex, false);
                        prop.setTemporalContinuousAtKey(keyIndex, false);
                        prop.setTemporalEaseAtKey(keyIndex, newIn, newOut);

                        if (continuous && keyIndex > 1 && keyIndex < prop.numKeys) {
                            try { prop.setTemporalContinuousAtKey(keyIndex, true); } catch(e2) {}
                        }

                        changed++;
                    } catch(itemErr) {}
                }
            }

            app.endUndoGroup();

            if (changed === 0) {
                return JSON.stringify({ ok: false, error: "Could not apply ease to selected properties." });
            }

            return JSON.stringify({
                ok: true,
                count: changed,
                msg: "Applied ease to " + changed + " keyframe" + (changed > 1 ? "s" : "") + "!"
            });
        } catch(err) {
            try { app.endUndoGroup(); } catch(e) {}
            return JSON.stringify({ ok: false, error: "Paste Ease Error: " + err.toString() });
        }
    };

    // 3. INVERT TIMING OF SELECTED KEYFRAMES (REVERSE ANIMATION)
    _mdkPro.invertKeyframes = function() {
        try {
            var comp = _getActiveComp();
            if (!comp) return JSON.stringify({ ok: false, error: "Please open an active composition." });

            var props = _getSelectedKeyProperties(comp);
            if (!props.length) return JSON.stringify({ ok: false, error: "Please select keyframes to invert." });

            app.beginUndoGroup("MotionByDk Invert Keyframes");

            var totalCount = 0;
            for (var p = 0; p < props.length; p++) {
                var prop = props[p];
                var keys = prop.selectedKeys;
                if (!keys || keys.length < 2) continue;

                var keyData = [];
                for (var i = 0; i < keys.length; i++) {
                    var idx = keys[i];
                    keyData.push({
                        time: prop.keyTime(idx),
                        val: prop.keyValue(idx),
                        inEase: prop.keyInTemporalEase(idx),
                        outEase: prop.keyOutTemporalEase(idx),
                        inInterp: prop.keyInInterpolationType(idx),
                        outInterp: prop.keyOutInterpolationType(idx)
                    });
                }

                // Invert times relative to span
                var minTime = keyData[0].time;
                var maxTime = keyData[keyData.length - 1].time;
                var span = maxTime - minTime;

                // Remove old keyframes from highest index to lowest
                for (var d = keys.length - 1; d >= 0; d--) {
                    prop.removeKey(keys[d]);
                }

                // Add inverted keyframes
                for (var j = 0; j < keyData.length; j++) {
                    var orig = keyData[j];
                    var newTime = minTime + (maxTime - orig.time);
                    var newIdx = prop.addKey(newTime);
                    prop.setValueAtKey(newIdx, orig.val);
                    // Invert In and Out ease
                    try {
                        prop.setInterpolationTypeAtKey(newIdx, orig.outInterp, orig.inInterp);
                        prop.setTemporalEaseAtKey(newIdx, orig.outEase, orig.inEase);
                    } catch(e) {}
                    totalCount++;
                }
            }

            app.endUndoGroup();

            return JSON.stringify({
                ok: true,
                count: totalCount,
                msg: "Inverted " + totalCount + " keyframes successfully!"
            });
        } catch(err) {
            try { app.endUndoGroup(); } catch(e) {}
            return JSON.stringify({ ok: false, error: "Invert Error: " + err.toString() });
        }
    };

    // 3. PERSISTENT TRIAL DISK STORAGE (Protects against browser cache/reinstall resets)
    _mdkPro.saveTrialDisk = function(dataStr) {
        try {
            var fld = new Folder(Folder.userData.fsName + "/MotionByDk");
            if (!fld.exists) fld.create();
            var f = new File(fld.fsName + "/.mdk_trial.dat");
            f.open("w");
            f.write(dataStr);
            f.close();
            return JSON.stringify({ ok: true });
        } catch(e) {
            return JSON.stringify({ ok: false, error: e.toString() });
        }
    };

    _mdkPro.readTrialDisk = function() {
        try {
            var f = new File(Folder.userData.fsName + "/MotionByDk/.mdk_trial.dat");
            if (f.exists) {
                f.open("r");
                var str = f.read();
                f.close();
                return JSON.stringify({ ok: true, data: str });
            }
            return JSON.stringify({ ok: false, error: "not_found" });
        } catch(e) {
            return JSON.stringify({ ok: false, error: e.toString() });
        }
    };

    // 4. INSTANT LIQUID GLASS EFFECT
    _mdkPro.applyLiquidGlass = function() {
        try {
            var comp = app.project ? app.project.activeItem : null;
            if (!comp || !(comp instanceof CompItem)) {
                return JSON.stringify({ ok: false, error: "Please open an active composition." });
            }

            app.beginUndoGroup("Apply Liquid Glass");

            var selLayers = comp.selectedLayers;
            var targetLayer = null;

            if (selLayers && selLayers.length > 0) {
                targetLayer = selLayers[0];
            } else {
                targetLayer = comp.layers.addSolid([0, 0, 0], "Liquid Glass FX", comp.width, comp.height, comp.pixelAspect, comp.duration);
                targetLayer.adjustmentLayer = true;
                targetLayer.startTime = comp.time;
            }

            var fxGroup = targetLayer.property("ADBE Effect Parade");
            if (!fxGroup) {
                app.endUndoGroup();
                return JSON.stringify({ ok: false, error: "Selected layer does not support effects." });
            }

            var fx = null;
            var namesToTry = ["Liquid Glass", "ToolsForMotion Liquid Glass", "com.toolsformotion.liquidglass", "LiquidGlass"];
            for (var i = 0; i < namesToTry.length; i++) {
                try {
                    fx = fxGroup.addProperty(namesToTry[i]);
                    if (fx) break;
                } catch(e) {}
            }

            if (!fx) {
                app.endUndoGroup();
                return JSON.stringify({
                    ok: false,
                    error: "plugin_missing",
                    msg: "Liquid Glass plugin is not installed in After Effects Plug-ins folder."
                });
            }

            app.endUndoGroup();
            return JSON.stringify({ ok: true, msg: "Liquid Glass applied successfully!" });
        } catch(err) {
            try { app.endUndoGroup(); } catch(e) {}
            return JSON.stringify({ ok: false, error: err.toString() });
        }
    };

    function _deleteFolderRecursive(folder) {
        if (!folder || !folder.exists) return;
        try {
            var files = folder.getFiles();
            for (var i = 0; i < files.length; i++) {
                if (files[i] instanceof Folder) {
                    _deleteFolderRecursive(files[i]);
                } else {
                    files[i].remove();
                }
            }
            folder.remove();
        } catch(e) {}
    }

    _mdkPro.cleanLegacyFolders = function() {
        try {
            var isWin = ($.os.indexOf("Windows") !== -1);
            var targets = [];
            if (isWin) {
                var appData = Folder.userData ? Folder.userData.fsName : "";
                var common = Folder.commonFiles ? Folder.commonFiles.fsName : "";
                if (appData) targets.push(appData + "\\Adobe\\CEP\\extensions\\MotionByDk AE Workflow");
                if (common) targets.push(common + "\\Adobe\\CEP\\extensions\\MotionByDk AE Workflow");
            } else {
                var userHome = Folder("~").fsName;
                targets.push(userHome + "/Library/Application Support/Adobe/CEP/extensions/MotionByDk AE Workflow");
                targets.push("/Library/Application Support/Adobe/CEP/extensions/MotionByDk AE Workflow");
            }

            var thisScript = new File($.fileName);
            var thisExtensionRoot = thisScript.parent.parent.fsName;

            for (var t = 0; t < targets.length; t++) {
                var oldF = new Folder(targets[t]);
                if (oldF.exists && oldF.fsName !== thisExtensionRoot) {
                    _deleteFolderRecursive(oldF);
                }
            }
            return "SUCCESS";
        } catch(err) {
            return "ERROR: " + err.toString();
        }
    };

    $._MDK_PRO = _mdkPro;
})();
