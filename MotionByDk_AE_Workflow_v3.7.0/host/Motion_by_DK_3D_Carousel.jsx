/**
 * Motion by DK – 3D Carousel (V2.1.2: Circle & Arc Carousel Edition - UPDATE & UI Sync Fix)
 * Author: Motion by DK (@motionbydk)
 * Version: 2.1.2
 * 
 * Description:
 * Production-ready ExtendScript (.jsx) tool for Adobe After Effects.
 * Supports independently operating 3D Circle Carousel and 3D Arc Carousel layouts
 * with master null controls, AE effect controls, 3D camera rigs, metadata restoration,
 * user comment preservation, expression ownership protection, and bulletproof UI/AE synchronization.
 * 
 * Compatibility: Adobe After Effects (ExtendScript / ScriptUI)
 */

(function (thisObj) {
    "use strict";

    // ------------------------------------------------------------------------
    // CONSTANTS & NAMESPACE
    // ------------------------------------------------------------------------
    var CIRCLE_MASTER_NAME = "C3D_CIRCLE_MASTER";
    var CIRCLE_CAMERA_NAME = "C3D_CIRCLE_CAMERA";
    var TAG_CIRCLE_MASTER = "C3D_TYPE=CIRCLE_MASTER";
    var TAG_CIRCLE_CAMERA = "C3D_TYPE=CIRCLE_CAMERA";

    var ARC_MASTER_NAME = "C3D_ARC_MASTER";
    var ARC_CAMERA_NAME = "C3D_ARC_CAMERA";
    var TAG_ARC_MASTER = "C3D_TYPE=ARC_MASTER";
    var TAG_ARC_CAMERA = "C3D_TYPE=ARC_CAMERA";

    var HELIX_MASTER_NAME = "C3D_HELIX_MASTER";
    var HELIX_CAMERA_NAME = "C3D_HELIX_CAMERA";
    var TAG_HELIX_MASTER = "C3D_TYPE=HELIX_MASTER";
    var TAG_HELIX_CAMERA = "C3D_TYPE=HELIX_CAMERA";

    var EASY_MASTER_NAME = "C3D_EASY_MASTER";
    var EASY_CAMERA_NAME = "C3D_EASY_CAMERA";
    var TAG_EASY_MASTER = "C3D_TYPE=EASY_MASTER";
    var TAG_EASY_CAMERA = "C3D_TYPE=EASY_CAMERA";

    var SPHERE_MASTER_NAME = "C3D_SPHERE_MASTER";
    var SPHERE_CAMERA_NAME = "C3D_SPHERE_CAMERA";
    var TAG_SPHERE_MASTER = "C3D_TYPE=SPHERE_MASTER";
    var TAG_SPHERE_CAMERA = "C3D_TYPE=SPHERE_CAMERA";

    var RING_MASTER_NAME = "C3D_RING_MASTER";
    var RING_CAMERA_NAME = "C3D_RING_CAMERA";
    var TAG_RING_MASTER = "C3D_TYPE=RING_MASTER";
    var TAG_RING_CAMERA = "C3D_TYPE=RING_CAMERA";

    var COVER_MASTER_NAME = "C3D_COVER_MASTER";
    var COVER_CAMERA_NAME = "C3D_COVER_CAMERA";
    var TAG_COVER_MASTER = "C3D_TYPE=COVER_MASTER";
    var TAG_COVER_CAMERA = "C3D_TYPE=COVER_CAMERA";

    var META_CIRCLE_PREFIX = "__MDK_C3D_CARD:CIRCLE:";
    var META_ARC_PREFIX = "__MDK_C3D_CARD:ARC:";
    var META_HELIX_PREFIX = "__MDK_C3D_CARD:HELIX:";
    var META_EASY_PREFIX = "__MDK_C3D_CARD:EASY:";
    var META_SPHERE_PREFIX = "__MDK_C3D_CARD:SPHERE:";
    var META_RING_PREFIX = "__MDK_C3D_CARD:RING:";
    var META_COVER_PREFIX = "__MDK_C3D_CARD:COVER:";
    var META_SUFFIX = "__";

    var EXPR_OWNERSHIP_MARKER = "// Motion by DK Auto Rotate Expression";

    var DEFAULT_RADIUS = 600;
    var MIN_RADIUS = 50;
    var DEFAULT_START_ANGLE = 0;
    var DEFAULT_CIRCLE_SPACING = 360;
    var DEFAULT_RING_SPACING = 360;
    var DEFAULT_COVER_SPACING = 180;
    var DEFAULT_COVER_ANGLE = 45;
    var DEFAULT_COVER_DEPTH = 250;
    var DEFAULT_COVER_SIDE_SCALE = 80;
    var DEFAULT_COVER_INDEX = 1;
    var DEFAULT_COVER_SHADOW_DIST = 25;
    var DEFAULT_COVER_SHADOW_SOFT = 40;
    var DEFAULT_COVER_SHADOW_OPAC = 60;
    var DEFAULT_COVER_MAX_BLUR = 20;
    var DEFAULT_ARC_ANGLE = 180;
    var DEFAULT_ARC_SPACING = 1.0;
    var DEFAULT_HELIX_VERT_SPACING = 100;
    var DEFAULT_HELIX_TWIST = 360;
    var DEFAULT_EASY_BACK_SCALE = 50;
    var DEFAULT_EASY_SCALE_EXP = 1.0;
    var DEFAULT_EASY_BACK_OPACITY = 30;
    var DEFAULT_EASY_OPAC_EXP = 1.5;
    var DEFAULT_EASY_PAUSE_DUR = 2.0;
    var DEFAULT_EASY_TRANS_DUR = 0.5;
    var DEFAULT_SPHERE_BACK_SCALE = 50;
    var DEFAULT_SPHERE_SCALE_EXP = 1.0;
    var DEFAULT_SPHERE_MAX_BLUR = 20;
    var DEFAULT_SCALE = 100;
    var MIN_SCALE = 1;
    var DEFAULT_ROT_X = 0;
    var DEFAULT_ROT_Y = 0;
    var DEFAULT_ROT_Z = 0;
    var DEFAULT_AUTO_ROTATE = false;
    var DEFAULT_ROT_SPEED = 20;

    // ------------------------------------------------------------------------
    // JSON METADATA & COMMENT PRESERVATION HELPERS
    // ------------------------------------------------------------------------
    function serializeMetadata(obj) {
        if (!obj) return "{}";
        var str = "{";
        var first = true;
        for (var key in obj) {
            if (obj.hasOwnProperty(key)) {
                if (!first) str += ",";
                first = false;
                str += '"' + key + '":';
                var val = obj[key];
                if (typeof val === "string") {
                    str += '"' + val + '"';
                } else if (typeof val === "number" || typeof val === "boolean") {
                    str += val.toString();
                } else if (val === null) {
                    str += "null";
                } else if (val instanceof Array) {
                    str += "[" + val.join(",") + "]";
                }
            }
        }
        str += "}";
        return str;
    }

    function parseMetadata(str) {
        if (!str || typeof str !== "string") return null;
        try {
            return eval("(" + str + ")");
        } catch (e) {
            return null;
        }
    }

    function extractMetadataFromComment(commentStr, prefixTag) {
        if (!commentStr || typeof commentStr !== "string") return null;
        var startIdx = commentStr.indexOf(prefixTag);
        if (startIdx === -1) return null;

        var jsonStart = startIdx + prefixTag.length;
        var endIdx = commentStr.indexOf(META_SUFFIX, jsonStart);
        if (endIdx === -1) return null;

        var jsonStr = commentStr.substring(jsonStart, endIdx);
        return parseMetadata(jsonStr);
    }

    function removeMetadataFromComment(commentStr, prefixTag) {
        if (!commentStr || typeof commentStr !== "string") return "";
        var startIdx = commentStr.indexOf(prefixTag);
        if (startIdx === -1) return commentStr;

        var endIdx = commentStr.indexOf(META_SUFFIX, startIdx + prefixTag.length);
        if (endIdx === -1) return commentStr;

        var before = commentStr.substring(0, startIdx);
        var after = commentStr.substring(endIdx + META_SUFFIX.length);
        return before + after;
    }

    // ------------------------------------------------------------------------
    // SAFETY HELPER UTILITIES
    // ------------------------------------------------------------------------
    function safeNumber(val, defaultVal, minVal, maxVal) {
        var n = parseFloat(val);
        if (isNaN(n) || !isFinite(n)) {
            n = defaultVal !== undefined ? defaultVal : 0;
        }
        if (minVal !== undefined && n < minVal) n = minVal;
        if (maxVal !== undefined && n > maxVal) n = maxVal;
        return n;
    }

    function safeSetValue(prop, value) {
        if (!prop || typeof prop.setValue !== "function") return false;
        if (value === undefined || value === null) return false;

        try {
            if (typeof value === "number") {
                if (isNaN(value) || !isFinite(value)) return false;
                prop.setValue(value);
                return true;
            } else if (value instanceof Array) {
                for (var i = 0; i < value.length; i++) {
                    if (typeof value[i] !== "number" || isNaN(value[i]) || !isFinite(value[i])) {
                        return false;
                    }
                }
                prop.setValue(value);
                return true;
            } else if (typeof value === "boolean") {
                prop.setValue(value ? 1 : 0);
                return true;
            }
        } catch (err) {
            return false;
        }
        return false;
    }

        var _lastCarouselError = "";
    function reportError(msg, isSilent) {
        _lastCarouselError = msg;
        if (typeof $ !== "undefined") $._MDK_3DCAROUSEL_LAST_ERROR = msg;
        if (!isSilent && (typeof $ === "undefined" || !$._MDK_3DCAROUSEL_NO_AUTO_SHOW)) {
            try { alert(msg); } catch(e) {}
        }
        return false;
    }

        function setCardPositionExpression(card, expr) {
        if (!card) return false;
        var tg = card.property("ADBE Transform Group") || card.property("Transform");
        if (!tg) return false;
        var p = tg.property("ADBE Position") || tg.property("Position");
        return safeSetExpression(p, expr);
    }

    function setCardScaleExpression(card, expr) {
        if (!card) return false;
        var tg = card.property("ADBE Transform Group") || card.property("Transform");
        if (!tg) return false;
        var s = tg.property("ADBE Scale") || tg.property("Scale");
        return safeSetExpression(s, expr);
    }

function safeSetExpression(prop, exprString) {
        if (!prop) return false;
        try {
            prop.expression = exprString || "";
            return true;
        } catch (e) {
            return false;
        }
    }

    function removeAllLayerExpressions(layer) {
        if (!layer) return;
        try {
            function clearPropsInGroup(propGroup) {
                if (!propGroup) return;
                var numProps = propGroup.numProperties;
                if (!numProps) return;
                for (var p = 1; p <= numProps; p++) {
                    try {
                        var prop = propGroup.property(p);
                        if (!prop) continue;
                        if (prop.propertyType === PropertyType.PROPERTY) {
                            if (prop.canSetExpression && prop.expression && prop.expression !== "") {
                                safeSetExpression(prop, "");
                            }
                        } else if (prop.propertyType === PropertyType.INDEXED_GROUP || prop.propertyType === PropertyType.NAMED_GROUP) {
                            clearPropsInGroup(prop);
                        }
                    } catch (eProp) {}
                }
            }
            clearPropsInGroup(layer);
        } catch (eAll) {}
    }

    function safeGetValue(prop, defaultVal) {
        if (!prop) return defaultVal;
        try {
            var val = prop.value;
            if (val !== undefined && val !== null) return val;
        } catch (e) {
            return defaultVal;
        }
        return defaultVal;
    }

    // ------------------------------------------------------------------------
    // EFFECTS PARADE & PROPERTY HELPERS
    // ------------------------------------------------------------------------
    function getEffectsGroup(layer) {
        if (!layer) return null;
        try {
            var fx = layer.property("ADBE Effect Parade");
            if (fx) return fx;
        } catch (e1) {}
        try {
            var fx2 = layer.property("Effects");
            if (fx2) return fx2;
        } catch (e2) {}
        try {
            var fx3 = layer.property("ADBE Effect Built-in Exec");
            if (fx3) return fx3;
        } catch (e3) {}
        return null;
    }

    function getEffectValueProperty(effectObj) {
        if (!effectObj) return null;
        try {
            if (effectObj.property("ADBE Slider Control-0001")) return effectObj.property("ADBE Slider Control-0001");
            if (effectObj.property("ADBE Checkbox Control-0001")) return effectObj.property("ADBE Checkbox Control-0001");
            if (effectObj.property("Slider")) return effectObj.property("Slider");
            if (effectObj.property("Checkbox")) return effectObj.property("Checkbox");
            if (effectObj.property(1)) return effectObj.property(1);
        } catch (e) {}
        return null;
    }

    function getOrAddEffect(layer, effectType, effectName) {
        if (!layer) return null;
        var fxGroup = getEffectsGroup(layer);
        if (!fxGroup) return null;

        var effect = null;
        try {
            effect = fxGroup.property(effectName);
        } catch (e1) {}

        if (!effect) {
            try {
                effect = fxGroup.addProperty(effectType);
                if (effect) {
                    effect.name = effectName;
                }
            } catch (e2) {
                return null;
            }
        }
        return effect;
    }

    function getOrAddBlurEffect(layer, effectName) {
        if (!layer) return null;
        var fxGroup = getEffectsGroup(layer);
        if (!fxGroup) return null;

        var effect = null;
        try {
            effect = fxGroup.property(effectName);
        } catch (e1) {}

        if (!effect) {
            var matchNames = ["ADBE Fast Blur", "ADBE Gaussian Blur 2", "ADBE Gaussian Blur"];
            for (var m = 0; m < matchNames.length; m++) {
                try {
                    effect = fxGroup.addProperty(matchNames[m]);
                    if (effect) {
                        effect.name = effectName;
                        break;
                    }
                } catch (e2) {}
            }
        }
        return effect;
    }

    function setEffectValue(effectObj, value) {
        if (!effectObj) return false;
        var valProp = getEffectValueProperty(effectObj);
        if (!valProp) return false;
        return safeSetValue(valProp, value);
    }

    function getEffectValue(effectObj, defaultVal) {
        if (!effectObj) return defaultVal;
        var valProp = getEffectValueProperty(effectObj);
        if (!valProp) return defaultVal;
        return safeGetValue(valProp, defaultVal);
    }

    // ------------------------------------------------------------------------
    // LAYER TRANSFORM HELPERS
    // ------------------------------------------------------------------------
    function setLayerPosition(layer, x, y, z) {
        if (!layer) return false;
        var tg = layer.property("ADBE Transform Group") || layer.property("Transform");
        if (!tg) return false;

        var isSeparated = false;
        try {
            var posProp = tg.property("ADBE Position") || tg.property("Position");
            if (posProp && posProp.isSeparated !== undefined) {
                isSeparated = posProp.isSeparated;
            }
        } catch (e) {}

        if (isSeparated) {
            var posX = tg.property("ADBE Position_0") || tg.property("X Position");
            var posY = tg.property("ADBE Position_1") || tg.property("Y Position");
            var posZ = tg.property("ADBE Position_2") || tg.property("Z Position");
            var resX = posX ? safeSetValue(posX, x) : false;
            var resY = posY ? safeSetValue(posY, y) : false;
            var resZ = posZ ? safeSetValue(posZ, z) : false;
            return resX && resY && resZ;
        } else {
            var posProp2 = tg.property("ADBE Position") || tg.property("Position");
            if (posProp2) {
                return safeSetValue(posProp2, [x, y, z]);
            }
        }
        return false;
    }

    function getLayerPosition(layer) {
        if (!layer) return [0, 0, 0];
        var tg = layer.property("ADBE Transform Group") || layer.property("Transform");
        if (!tg) return [0, 0, 0];

        var isSeparated = false;
        try {
            var posProp = tg.property("ADBE Position") || tg.property("Position");
            if (posProp && posProp.isSeparated !== undefined) {
                isSeparated = posProp.isSeparated;
            }
        } catch (e) {}

        if (isSeparated) {
            var posX = tg.property("ADBE Position_0") || tg.property("X Position");
            var posY = tg.property("ADBE Position_1") || tg.property("Y Position");
            var posZ = tg.property("ADBE Position_2") || tg.property("Z Position");
            return [
                posX ? posX.value : 0,
                posY ? posY.value : 0,
                posZ ? posZ.value : 0
            ];
        } else {
            var posProp2 = tg.property("ADBE Position") || tg.property("Position");
            if (posProp2 && posProp2.value) {
                var p = posProp2.value;
                return [p[0], p[1], p.length > 2 ? p[2] : 0];
            }
        }
        return [0, 0, 0];
    }

    function setLayerRotation(layer, facingY) {
        if (!layer) return false;
        var tg = layer.property("ADBE Transform Group") || layer.property("Transform");
        if (!tg) return false;

        var yRotProp = tg.property("ADBE Y Rotation") || tg.property("Y Rotation");
        var xRotProp = tg.property("ADBE X Rotation") || tg.property("X Rotation");
        var zRotProp = tg.property("ADBE Z Rotation") || tg.property("Z Rotation");
        var orientProp = tg.property("ADBE Orientation") || tg.property("Orientation");

        if (yRotProp) {
            safeSetValue(yRotProp, facingY);
            if (xRotProp) safeSetValue(xRotProp, 0);
            if (zRotProp) safeSetValue(zRotProp, 0);
            return true;
        } else if (orientProp) {
            safeSetValue(orientProp, [0, facingY, 0]);
            return true;
        }
        return false;
    }

    function setLayerScale(layer, finalScale) {
        if (!layer || !finalScale) return false;
        var tg = layer.property("ADBE Transform Group") || layer.property("Transform");
        if (!tg) return false;
        var scaleProp = tg.property("ADBE Scale") || tg.property("Scale");
        if (scaleProp) {
            return safeSetValue(scaleProp, finalScale);
        }
        return false;
    }

    function updateAutoRotateExpression(masterNull) {
        if (!masterNull) return;
        var tg = masterNull.property("ADBE Transform Group") || masterNull.property("Transform");
        if (!tg) return;

        var rxProp = tg.property("ADBE X Rotation") || tg.property("X Rotation");
        if (rxProp) {
            safeSetExpression(rxProp, EXPR_OWNERSHIP_MARKER + "\n" + "effect('C3D X Rotation')(1).value;");
        }

        var rzProp = tg.property("ADBE Z Rotation") || tg.property("Z Rotation");
        if (rzProp) {
            var fxGroup = getEffectsGroup(masterNull);
            var eVert = fxGroup ? fxGroup.property("C3D Vertical Mode") : null;
            if (eVert) {
                safeSetExpression(rzProp, EXPR_OWNERSHIP_MARKER + "\n" + "if (effect('C3D Vertical Mode')('Checkbox').value == 1) { 90; } else { effect('C3D Z Rotation')(1).value; }");
            } else {
                safeSetExpression(rzProp, EXPR_OWNERSHIP_MARKER + "\n" + "effect('C3D Z Rotation')(1).value;");
            }
        }

        var yRotProp = tg.property("ADBE Y Rotation") || tg.property("Y Rotation");
        if (yRotProp) {
            var currentExpr = yRotProp.expression || "";
            var isPluginOwned = (currentExpr.indexOf(EXPR_OWNERSHIP_MARKER) !== -1);
            var hasUserExpression = (currentExpr.length > 0 && !isPluginOwned);

            // Set plugin expression unless layer has a custom user-written expression
            if (!hasUserExpression) {
                var exprStr = EXPR_OWNERSHIP_MARKER + '\n' +
                              'var userRot = effect("C3D Y Rotation")("Slider").value;\n' +
                              'var autoRot = effect("C3D Auto Rotate")("Checkbox").value;\n' +
                              'var rotSpeed = effect("C3D Rotation Speed")("Slider").value;\n' +
                              '(autoRot == 1 || autoRot == true) ? (userRot + time * rotSpeed) : userRot;';
                safeSetExpression(yRotProp, exprStr);
            }
        }
    }

    function getActiveComp() {
        var comp = app.project.activeItem;
        if (!comp || !(comp instanceof CompItem)) {
            return null;
        }
        return comp;
    }

    // ------------------------------------------------------------------------
    // CIRCLE CAROUSEL ENGINE (V1 - STRICT ISOLATION & SKIP UNDO SUPPORT)
    // ------------------------------------------------------------------------
    function findCircleMaster(comp) {
        if (!comp) return null;
        for (var i = 1; i <= comp.numLayers; i++) {
            var l = comp.layer(i);
            if (!l) continue;
            var comment = l.comment || "";
            if (l.name === CIRCLE_MASTER_NAME || comment.indexOf(TAG_CIRCLE_MASTER) !== -1) {
                return l;
            }
        }
        return null;
    }

    function findCircleCamera(comp) {
        if (!comp) return null;
        for (var i = 1; i <= comp.numLayers; i++) {
            var l = comp.layer(i);
            if (!l) continue;
            var comment = l.comment || "";
            if (l.name === CIRCLE_CAMERA_NAME || comment.indexOf(TAG_CIRCLE_CAMERA) !== -1) {
                return l;
            }
        }
        return null;
    }

    function setupCircleMasterNull(comp, radius, startAngle, spacing, scaleVal, rotX, rotY, rotZ, autoRotate, rotSpeed) {
        if (!comp) return null;
        var master = findCircleMaster(comp);
        if (!master) {
            master = comp.layers.addNull();
            if (!master) return null;
            master.name = CIRCLE_MASTER_NAME;
            master.comment = TAG_CIRCLE_MASTER;
            master.guideLayer = true;
            master.label = 13;
        }

        try { master.threeDLayer = true; } catch (e) {}
        setLayerPosition(master, comp.width / 2, comp.height / 2, 0);

        setEffectValue(getOrAddEffect(master, "ADBE Slider Control", "C3D Radius"), safeNumber(radius, DEFAULT_RADIUS, MIN_RADIUS));
        setEffectValue(getOrAddEffect(master, "ADBE Slider Control", "C3D Start Angle"), safeNumber(startAngle, DEFAULT_START_ANGLE));
        setEffectValue(getOrAddEffect(master, "ADBE Slider Control", "C3D Spacing"), safeNumber(spacing, DEFAULT_CIRCLE_SPACING));
        setEffectValue(getOrAddEffect(master, "ADBE Slider Control", "C3D Scale"), safeNumber(scaleVal, DEFAULT_SCALE, MIN_SCALE));
        setEffectValue(getOrAddEffect(master, "ADBE Slider Control", "C3D X Rotation"), safeNumber(rotX, DEFAULT_ROT_X));
        setEffectValue(getOrAddEffect(master, "ADBE Slider Control", "C3D Y Rotation"), safeNumber(rotY, DEFAULT_ROT_Y));
        setEffectValue(getOrAddEffect(master, "ADBE Slider Control", "C3D Z Rotation"), safeNumber(rotZ, DEFAULT_ROT_Z));
        setEffectValue(getOrAddEffect(master, "ADBE Checkbox Control", "C3D Auto Rotate"), autoRotate ? 1 : 0);
        setEffectValue(getOrAddEffect(master, "ADBE Slider Control", "C3D Rotation Speed"), safeNumber(rotSpeed, DEFAULT_ROT_SPEED));

        updateAutoRotateExpression(master);
        return master;
    }

    function setupCircleCamera(comp, masterNull, radius) {
        return null;
    }

    function getCircleCarouselCards(comp, masterNull) {
        var cards = [];
        if (!comp || !masterNull) return cards;

        for (var i = 1; i <= comp.numLayers; i++) {
            var l = comp.layer(i);
            if (!l) continue;
            var comment = l.comment || "";
            // STRICT FILTERING: Must be parented to Circle Master AND contain Circle metadata prefix
            if (l.parent === masterNull && comment.indexOf(META_CIRCLE_PREFIX) !== -1) {
                cards.push(l);
            }
        }
        return cards;
    }

    function applyCircleLayout(comp, masterNull, cards, settings) {
        if (!comp || !masterNull || !cards || cards.length === 0) return false;

        var radius = safeNumber(settings.radius, DEFAULT_RADIUS, MIN_RADIUS);
        var startAngle = safeNumber(settings.startAngle, DEFAULT_START_ANGLE);
        var spacing = safeNumber(settings.spacing, DEFAULT_CIRCLE_SPACING);
        var scaleVal = safeNumber(settings.scale, DEFAULT_SCALE, MIN_SCALE);

        var totalCount = cards.length;

        for (var k = 0; k < totalCount; k++) {
            var card = cards[k];
            if (!card) continue;

            try { card.threeDLayer = true; } catch (e) {}
            card.parent = masterNull;

            var origScale = [100, 100, 100];
            var comment = card.comment || "";

            var metaObj = extractMetadataFromComment(comment, META_CIRCLE_PREFIX);
            if (metaObj && metaObj.origScale) {
                origScale = metaObj.origScale;
            }

            var origX = (origScale && origScale[0] !== undefined) ? origScale[0] : 100;
            var origY = (origScale && origScale[1] !== undefined) ? origScale[1] : 100;
            var origZ = (origScale && origScale[2] !== undefined) ? origScale[2] : 100;

            var tgCard = card.property("ADBE Transform Group") || card.property("Transform");
            if (tgCard) {
                // Position Expression
                var posExpr = EXPR_OWNERSHIP_MARKER + "\n" +
                              "var ctrl = parent;\n" +
                              "var r = ctrl.effect('C3D Radius')(1).value;\n" +
                              "var startA = ctrl.effect('C3D Start Angle')(1).value;\n" +
                              "var spacing = ctrl.effect('C3D Spacing')(1).value;\n" +
                              "var num = " + totalCount + ";\n" +
                              "var idx = " + k + ";\n" +
                              "var stepA = (num > 0) ? (spacing / num) : 0;\n" +
                              "var angleDeg = startA + (idx * stepA);\n" +
                              "var angleRad = degreesToRadians(angleDeg);\n" +
                              "var x = Math.sin(angleRad) * r;\n" +
                              "var z = Math.cos(angleRad) * r;\n" +
                              "[x, 0, z];";
                var pProp = tgCard.property("ADBE Position") || tgCard.property("Position");
                if (pProp) safeSetExpression(pProp, posExpr);

                // Scale Expression
                var scaleExpr = EXPR_OWNERSHIP_MARKER + "\n" +
                                "var ctrl = parent;\n" +
                                "var factor = ctrl.effect('C3D Scale')(1).value / 100;\n" +
                                "[" + origX + " * factor, " + origY + " * factor, " + origZ + " * factor];";
                var sProp = tgCard.property("ADBE Scale") || tgCard.property("Scale");
                if (sProp) safeSetExpression(sProp, scaleExpr);

                // Y Rotation Expression (Facing outward)
                var ryProp = tgCard.property("ADBE Rotate Y") || tgCard.property("ADBE Y Rotation") || tgCard.property("Y Rotation");
                if (ryProp) {
                    var rotYExpr = EXPR_OWNERSHIP_MARKER + "\n" +
                                   "var ctrl = parent;\n" +
                                   "var startA = ctrl.effect('C3D Start Angle')(1).value;\n" +
                                   "var spacing = ctrl.effect('C3D Spacing')(1).value;\n" +
                                   "var num = " + totalCount + ";\n" +
                                   "var idx = " + k + ";\n" +
                                   "var stepA = (num > 0) ? (spacing / num) : 0;\n" +
                                   "startA + (idx * stepA) + 180;";
                    safeSetExpression(ryProp, rotYExpr);
                }
            }
        }

        updateAutoRotateExpression(masterNull);
        return true;
    }

    function createCircleCarousel(params) {
        var comp = getActiveComp();
        if (!comp) {
            reportError("No active composition found. Please open a composition in After Effects.");
            return false;
        }

        var selected = comp.selectedLayers;
        if (!selected || selected.length === 0) {
            reportError("Please select at least 2 artwork layers in the active composition.");
            return false;
        }

        var validLayers = [];
        for (var i = 0; i < selected.length; i++) {
            var l = selected[i];
            if (!l) continue;
            if (l.name !== CIRCLE_MASTER_NAME && l.name !== CIRCLE_CAMERA_NAME &&
                l.name !== ARC_MASTER_NAME && l.name !== ARC_CAMERA_NAME &&
                l.name !== HELIX_MASTER_NAME && l.name !== HELIX_CAMERA_NAME &&
                l.name !== EASY_MASTER_NAME && l.name !== EASY_CAMERA_NAME &&
                l.name !== SPHERE_MASTER_NAME && l.name !== SPHERE_CAMERA_NAME) {
                validLayers.push(l);
            }
        }

        if (validLayers.length < 2) {
            reportError("Please select at least 2 artwork layers in the active composition.");
            return false;
        }

        if (findCircleMaster(comp)) {
            reportError("Circle Carousel already exists in this composition. Use UPDATE or DELETE.");
            return false;
        }

        app.beginUndoGroup("Create Circle Carousel – Motion by DK");

        try {
            var radius = safeNumber(params.radius, DEFAULT_RADIUS, MIN_RADIUS);
            var startAngle = safeNumber(params.startAngle, DEFAULT_START_ANGLE);
            var spacing = safeNumber(params.spacing, DEFAULT_CIRCLE_SPACING);
            var scaleVal = safeNumber(params.scale, DEFAULT_SCALE, MIN_SCALE);
            var rotX = safeNumber(params.rotX, DEFAULT_ROT_X);
            var rotY = safeNumber(params.rotY, DEFAULT_ROT_Y);
            var rotZ = safeNumber(params.rotZ, DEFAULT_ROT_Z);
            var autoRotate = params.autoRotate === true;
            var rotSpeed = safeNumber(params.rotSpeed, DEFAULT_ROT_SPEED);

            var master = setupCircleMasterNull(comp, radius, startAngle, spacing, scaleVal, rotX, rotY, rotZ, autoRotate, rotSpeed);
            if (!master) {
                reportError("Operation failed during Create Circle: Unable to create Master Null controller.");
                app.endUndoGroup();
                return false;
            }

            var totalCount = validLayers.length;
            for (var j = 0; j < totalCount; j++) {
                var card = validLayers[j];
                var is3D = card.threeDLayer;
                var origPos = getLayerPosition(card);
                var tg = card.property("ADBE Transform Group") || card.property("Transform");
                var origScale = [100, 100, 100];
                var origOrient = [0, 0, 0];
                var origRotX = 0, origRotY = 0, origRotZ = 0;

                if (tg) {
                    var sProp = tg.property("ADBE Scale") || tg.property("Scale");
                    if (sProp && sProp.value) origScale = sProp.value;
                    var oProp = tg.property("ADBE Orientation") || tg.property("Orientation");
                    if (oProp && oProp.value) origOrient = oProp.value;
                    var rxProp = tg.property("ADBE X Rotation") || tg.property("X Rotation");
                    if (rxProp && rxProp.value !== undefined) origRotX = rxProp.value;
                    var ryProp = tg.property("ADBE Y Rotation") || tg.property("Y Rotation");
                    if (ryProp && ryProp.value !== undefined) origRotY = ryProp.value;
                    var rzProp = tg.property("ADBE Z Rotation") || tg.property("Z Rotation");
                    if (rzProp && rzProp.value !== undefined) origRotZ = rzProp.value;
                }

                var metaObj = {
                    C3D_TYPE: "CIRCLE_CARD",
                    orig3D: is3D,
                    origParentName: (card.parent && card.parent.name) ? card.parent.name : null,
                    origParentIndex: (card.parent && card.parent.index) ? card.parent.index : null,
                    origPos: [origPos[0], origPos[1], origPos[2]],
                    origScale: [origScale[0], origScale[1], origScale[2]],
                    origOrient: [origOrient[0], origOrient[1], origOrient[2]],
                    origRotX: origRotX, origRotY: origRotY, origRotZ: origRotZ
                };
                
                // Append metadata safely without overwriting user comments
                var existingComment = card.comment || "";
                var cleanComment = removeMetadataFromComment(existingComment, META_CIRCLE_PREFIX);
                card.comment = cleanComment + META_CIRCLE_PREFIX + serializeMetadata(metaObj) + META_SUFFIX;
                card.parent = master;
            }

            var settings = { radius: radius, startAngle: startAngle, spacing: spacing, scale: scaleVal };
            applyCircleLayout(comp, master, validLayers, settings);

            app.endUndoGroup();
            return true;

        } catch (err) {
            app.endUndoGroup();
            reportError("Operation failed during Create Circle:\n" + err.toString());
            return false;
        }
    }

    function updateCircleCarousel(params, skipUndo) {
        var comp = getActiveComp();
        if (!comp) return reportError("No active composition found.", params && (params.silent || params.isLivePreview));

        var master = findCircleMaster(comp);
        if (!master) return reportError("C3D_CIRCLE_MASTER not found in active composition. Use CREATE CIRCLE first.", params && (params.silent || params.isLivePreview));

        if (params && (params.silent || params.isLivePreview)) skipUndo = true;
        if (!skipUndo) app.beginUndoGroup("Update Circle Carousel – Motion by DK");

        try {
            var eRadius = getOrAddEffect(master, "ADBE Slider Control", "C3D Radius");
            var eAngle = getOrAddEffect(master, "ADBE Slider Control", "C3D Start Angle");
            var eSpacing = getOrAddEffect(master, "ADBE Slider Control", "C3D Spacing");
            var eScale = getOrAddEffect(master, "ADBE Slider Control", "C3D Scale");
            var eRotX = getOrAddEffect(master, "ADBE Slider Control", "C3D X Rotation");
            var eRotY = getOrAddEffect(master, "ADBE Slider Control", "C3D Y Rotation");
            var eRotZ = getOrAddEffect(master, "ADBE Slider Control", "C3D Z Rotation");
            var eAutoRot = getOrAddEffect(master, "ADBE Checkbox Control", "C3D Auto Rotate");
            var eSpeed = getOrAddEffect(master, "ADBE Slider Control", "C3D Rotation Speed");

            if (params.radius !== undefined) setEffectValue(eRadius, safeNumber(params.radius, DEFAULT_RADIUS, MIN_RADIUS));
            if (params.startAngle !== undefined) setEffectValue(eAngle, safeNumber(params.startAngle, DEFAULT_START_ANGLE));
            if (params.spacing !== undefined) setEffectValue(eSpacing, safeNumber(params.spacing, DEFAULT_CIRCLE_SPACING));
            if (params.scale !== undefined) setEffectValue(eScale, safeNumber(params.scale, DEFAULT_SCALE, MIN_SCALE));
            if (params.rotX !== undefined) setEffectValue(eRotX, safeNumber(params.rotX, DEFAULT_ROT_X));
            if (params.rotY !== undefined) setEffectValue(eRotY, safeNumber(params.rotY, DEFAULT_ROT_Y));
            if (params.rotZ !== undefined) setEffectValue(eRotZ, safeNumber(params.rotZ, DEFAULT_ROT_Z));
            if (params.autoRotate !== undefined) setEffectValue(eAutoRot, params.autoRotate ? 1 : 0);
            if (params.rotSpeed !== undefined) setEffectValue(eSpeed, safeNumber(params.rotSpeed, DEFAULT_ROT_SPEED));

            var radius = getEffectValue(eRadius, safeNumber(params.radius, DEFAULT_RADIUS, MIN_RADIUS));
            var startAngle = getEffectValue(eAngle, safeNumber(params.startAngle, DEFAULT_START_ANGLE));
            var spacing = getEffectValue(eSpacing, safeNumber(params.spacing, DEFAULT_CIRCLE_SPACING));
            var scaleVal = getEffectValue(eScale, safeNumber(params.scale, DEFAULT_SCALE, MIN_SCALE));

            updateAutoRotateExpression(master);

            var cards = getCircleCarouselCards(comp, master);
            var settings = { radius: radius, startAngle: startAngle, spacing: spacing, scale: scaleVal };
            applyCircleLayout(comp, master, cards, settings);

            if (!skipUndo) app.endUndoGroup();
            return true;

        } catch (err) {
            if (!skipUndo) app.endUndoGroup();
            reportError("Operation failed during Update Circle:\n" + err.toString(), (typeof params !== "undefined" && params) ? (params.silent || params.isLivePreview) : false);
            return false;
        }
    }

    function resetCircleCarousel() {
        var comp = getActiveComp();
        if (!comp) return false;

        app.beginUndoGroup("Reset Circle Carousel – Motion by DK");
        try {
            var defaults = {
                radius: DEFAULT_RADIUS,
                startAngle: DEFAULT_START_ANGLE,
                spacing: DEFAULT_CIRCLE_SPACING,
                scale: DEFAULT_SCALE,
                autoRotate: DEFAULT_AUTO_ROTATE,
                rotSpeed: DEFAULT_ROT_SPEED
            };

            var master = findCircleMaster(comp);
            if (master) {
                updateCircleCarousel(defaults, true); // skipUndo = true prevents nested undo groups!
            }
            app.endUndoGroup();
            return true;
        } catch (e) {
            app.endUndoGroup();
            return false;
        }
    }

    function deleteCircleCarousel() {
        var comp = getActiveComp();
        if (!comp) return reportError("No active composition found.", (typeof params !== "undefined" && params) ? (params.silent || params.isLivePreview) : false);

        var master = findCircleMaster(comp);
        var camera = findCircleCamera(comp);
        if (!master && !camera) return reportError("No Circle Carousel controllers found in active composition.");

        app.beginUndoGroup("Delete Circle Carousel – Motion by DK");

        try {
            var cards = getCircleCarouselCards(comp, master);
            var arcMaster = findArcMaster(comp);
            var arcCamera = findArcCamera(comp);
            var helixMaster = findHelixMaster(comp);
            var helixCamera = findHelixCamera(comp);
            var easyMaster = findEasyMaster(comp);
            var easyCamera = findEasyCamera(comp);

            for (var i = 0; i < cards.length; i++) {
                var card = cards[i];
                if (!card) continue;

                removeAllLayerExpressions(card);

                var metaObj = extractMetadataFromComment(card.comment, META_CIRCLE_PREFIX);
                if (metaObj) {
                    card.comment = removeMetadataFromComment(card.comment, META_CIRCLE_PREFIX);
                }

                var restoredParent = false;
                if (metaObj && metaObj.origParentName) {
                    try {
                        var pLayer = comp.layer(metaObj.origParentName);
                        // PREVENT RE-PARENTING TO CAROUSEL MASTERS OR CAMERAS
                        if (pLayer && pLayer !== master && pLayer !== camera && pLayer !== arcMaster && pLayer !== arcCamera && pLayer !== helixMaster && pLayer !== helixCamera && pLayer !== easyMaster && pLayer !== easyCamera) {
                            card.parent = pLayer;
                            restoredParent = true;
                        }
                    } catch (e1) {}
                }
                if (!restoredParent && metaObj && metaObj.origParentIndex) {
                    try {
                        var pLayerIdx = comp.layer(metaObj.origParentIndex);
                        if (pLayerIdx && pLayerIdx !== master && pLayerIdx !== camera && pLayerIdx !== arcMaster && pLayerIdx !== arcCamera && pLayerIdx !== helixMaster && pLayerIdx !== helixCamera && pLayerIdx !== easyMaster && pLayerIdx !== easyCamera) {
                            card.parent = pLayerIdx;
                            restoredParent = true;
                        }
                    } catch (e2) {}
                }
                if (!restoredParent) card.parent = null;

                if (metaObj) {
                    if (metaObj.origPos) setLayerPosition(card, metaObj.origPos[0], metaObj.origPos[1], metaObj.origPos[2]);
                    if (metaObj.origScale) setLayerScale(card, metaObj.origScale);
                    var tg = card.property("ADBE Transform Group") || card.property("Transform");
                    if (tg) {
                        if (metaObj.origOrient && tg.property("ADBE Orientation")) safeSetValue(tg.property("ADBE Orientation"), metaObj.origOrient);
                        if (metaObj.origRotX !== undefined && tg.property("ADBE X Rotation")) safeSetValue(tg.property("ADBE X Rotation"), metaObj.origRotX);
                        if (metaObj.origRotY !== undefined && tg.property("ADBE Y Rotation")) safeSetValue(tg.property("ADBE Y Rotation"), metaObj.origRotY);
                        if (metaObj.origRotZ !== undefined && tg.property("ADBE Z Rotation")) safeSetValue(tg.property("ADBE Z Rotation"), metaObj.origRotZ);
                    }
                    if (metaObj.orig3D !== undefined) { try { card.threeDLayer = metaObj.orig3D; } catch (e3D) {} }
                }
            }

            if (master) try { master.remove(); } catch (eRem1) {}
            if (camera) try { camera.remove(); } catch (eRem2) {}

            app.endUndoGroup();
            return true;

        } catch (err) {
            app.endUndoGroup();
            reportError("Operation failed during Delete Circle:\n" + err.toString());
            return false;
        }
    }

    // ------------------------------------------------------------------------
    // ARC CAROUSEL ENGINE (V2.1 - AUTHORITATIVE SPAN & SKIP UNDO SUPPORT)
    // ------------------------------------------------------------------------
    function findArcMaster(comp) {
        if (!comp) return null;
        for (var i = 1; i <= comp.numLayers; i++) {
            var l = comp.layer(i);
            if (!l) continue;
            var comment = l.comment || "";
            if (l.name === ARC_MASTER_NAME || comment.indexOf(TAG_ARC_MASTER) !== -1) {
                return l;
            }
        }
        return null;
    }

    function findArcCamera(comp) {
        if (!comp) return null;
        for (var i = 1; i <= comp.numLayers; i++) {
            var l = comp.layer(i);
            if (!l) continue;
            var comment = l.comment || "";
            if (l.name === ARC_CAMERA_NAME || comment.indexOf(TAG_ARC_CAMERA) !== -1) {
                return l;
            }
        }
        return null;
    }

    function setupArcMasterNull(comp, radius, startAngle, arcAngle, spacing, scaleVal, autoRotate, rotSpeed) {
        if (!comp) return null;
        var master = findArcMaster(comp);
        if (!master) {
            master = comp.layers.addNull();
            if (!master) return null;
            master.name = ARC_MASTER_NAME;
            master.comment = TAG_ARC_MASTER;
            master.guideLayer = true;
            master.label = 10;
        }

        try { master.threeDLayer = true; } catch (e) {}
        setLayerPosition(master, comp.width / 2, comp.height / 2, 0);

        setEffectValue(getOrAddEffect(master, "ADBE Slider Control", "C3D Radius"), safeNumber(radius, DEFAULT_RADIUS, MIN_RADIUS));
        setEffectValue(getOrAddEffect(master, "ADBE Slider Control", "C3D Start Angle"), safeNumber(startAngle, DEFAULT_START_ANGLE));
        setEffectValue(getOrAddEffect(master, "ADBE Slider Control", "C3D Arc Angle"), safeNumber(arcAngle, DEFAULT_ARC_ANGLE, 10, 720));
        setEffectValue(getOrAddEffect(master, "ADBE Slider Control", "C3D Spacing"), safeNumber(spacing, DEFAULT_ARC_SPACING, 0.1, 5.0));
        setEffectValue(getOrAddEffect(master, "ADBE Slider Control", "C3D Scale"), safeNumber(scaleVal, DEFAULT_SCALE, MIN_SCALE));
        setEffectValue(getOrAddEffect(master, "ADBE Checkbox Control", "C3D Auto Rotate"), autoRotate ? 1 : 0);
        setEffectValue(getOrAddEffect(master, "ADBE Slider Control", "C3D Rotation Speed"), safeNumber(rotSpeed, DEFAULT_ROT_SPEED));

        updateAutoRotateExpression(master);
        return master;
    }

    function setupArcCamera(comp, masterNull, radius) {
        return null;
    }

    function getArcCarouselCards(comp, masterNull) {
        var cards = [];
        if (!comp || !masterNull) return cards;

        for (var i = 1; i <= comp.numLayers; i++) {
            var l = comp.layer(i);
            if (!l) continue;
            var comment = l.comment || "";
            // STRICT FILTERING: Must be parented to Arc Master AND contain Arc metadata prefix
            if (l.parent === masterNull && comment.indexOf(META_ARC_PREFIX) !== -1) {
                cards.push(l);
            }
        }
        return cards;
    }

    function applyArcLayout(comp, masterNull, cards, settings) {
        if (!comp || !masterNull || !cards || cards.length === 0) return false;

        var radius = safeNumber(settings.radius, DEFAULT_RADIUS, MIN_RADIUS);
        var startAngle = safeNumber(settings.startAngle, DEFAULT_START_ANGLE);
        var arcAngle = safeNumber(settings.arcAngle, DEFAULT_ARC_ANGLE, 10, 720);
        var spacing = safeNumber(settings.spacing, DEFAULT_ARC_SPACING, 0.1, 5.0);
        var scaleVal = safeNumber(settings.scale, DEFAULT_SCALE, MIN_SCALE);

        var totalCount = cards.length;

        for (var k = 0; k < totalCount; k++) {
            var card = cards[k];
            if (!card) continue;

            try { card.threeDLayer = true; } catch (e) {}

            var origScale = [100, 100, 100];
            var comment = card.comment || "";

            var metaObj = extractMetadataFromComment(comment, META_ARC_PREFIX);
            if (metaObj && metaObj.origScale) {
                origScale = metaObj.origScale;
            }

            // AUTHORITATIVE ARC MATH:
            // Arc Angle strictly defines total span (Start Angle -> Start Angle + Arc Angle)
            // First card (k = 0) is ALWAYS at Start Angle
            // Last card (k = totalCount - 1) is ALWAYS at Start Angle + Arc Angle
            var t = (totalCount > 1) ? (k / (totalCount - 1)) : 0;
            
            // Spacing adjusts inner card density without changing total Arc Angle span
            var t_spaced = t;
            if (spacing !== 1.0 && t > 0 && t < 1) {
                t_spaced = Math.pow(t, 1 / spacing);
            }

            var angleDeg = startAngle + (t_spaced * arcAngle);
            var angleRad = angleDeg * Math.PI / 180;

            var x = Math.sin(angleRad) * radius;
            var z = Math.cos(angleRad) * radius;
            var y = 0;

            var facingY = angleDeg + 180;

            var origX = (origScale && origScale[0] !== undefined) ? origScale[0] : 100;
            var origY = (origScale && origScale[1] !== undefined) ? origScale[1] : 100;
            var origZ = (origScale && origScale[2] !== undefined) ? origScale[2] : 100;

            var factor = scaleVal / 100;
            var finalScale = [origX * factor, origY * factor, origZ * factor];

            setLayerPosition(card, x, y, z);
            setLayerRotation(card, facingY);
            setLayerScale(card, finalScale);
        }

        return true;
    }

    function createArcCarousel(params) {
        var comp = getActiveComp();
        if (!comp) {
            reportError("No active composition found. Please open a composition in After Effects.");
            return false;
        }

        var selected = comp.selectedLayers;
        if (!selected || selected.length === 0) {
            reportError("Please select at least 2 artwork layers in the active composition.");
            return false;
        }

        var validLayers = [];
        for (var i = 0; i < selected.length; i++) {
            var l = selected[i];
            if (!l) continue;
            if (l.name !== CIRCLE_MASTER_NAME && l.name !== CIRCLE_CAMERA_NAME &&
                l.name !== ARC_MASTER_NAME && l.name !== ARC_CAMERA_NAME &&
                l.name !== HELIX_MASTER_NAME && l.name !== HELIX_CAMERA_NAME) {
                validLayers.push(l);
            }
        }

        if (validLayers.length < 2) {
            reportError("Please select at least 2 artwork layers in the active composition.");
            return false;
        }

        if (findArcMaster(comp)) {
            reportError("Arc Carousel already exists in this composition. Use UPDATE or DELETE.");
            return false;
        }

        app.beginUndoGroup("Create Arc Carousel – Motion by DK");

        try {
            var radius = safeNumber(params.radius, DEFAULT_RADIUS, MIN_RADIUS);
            var startAngle = safeNumber(params.startAngle, DEFAULT_START_ANGLE);
            var arcAngle = safeNumber(params.arcAngle, DEFAULT_ARC_ANGLE, 10, 720);
            var spacing = safeNumber(params.spacing, DEFAULT_ARC_SPACING, 0.1, 5.0);
            var scaleVal = safeNumber(params.scale, DEFAULT_SCALE, MIN_SCALE);
            var autoRotate = params.autoRotate === true;
            var rotSpeed = safeNumber(params.rotSpeed, DEFAULT_ROT_SPEED);

            var master = setupArcMasterNull(comp, radius, startAngle, arcAngle, spacing, scaleVal, autoRotate, rotSpeed);
            if (!master) {
                reportError("Operation failed during Create Arc: Unable to create Master Null controller.");
                app.endUndoGroup();
                return false;
            }

            var totalCount = validLayers.length;
            for (var j = 0; j < totalCount; j++) {
                var card = validLayers[j];
                var is3D = card.threeDLayer;
                var origPos = getLayerPosition(card);
                var tg = card.property("ADBE Transform Group") || card.property("Transform");
                var origScale = [100, 100, 100];
                var origOrient = [0, 0, 0];
                var origRotX = 0, origRotY = 0, origRotZ = 0;

                if (tg) {
                    var sProp = tg.property("ADBE Scale") || tg.property("Scale");
                    if (sProp && sProp.value) origScale = sProp.value;
                    var oProp = tg.property("ADBE Orientation") || tg.property("Orientation");
                    if (oProp && oProp.value) origOrient = oProp.value;
                    var rxProp = tg.property("ADBE X Rotation") || tg.property("X Rotation");
                    if (rxProp && rxProp.value !== undefined) origRotX = rxProp.value;
                    var ryProp = tg.property("ADBE Y Rotation") || tg.property("Y Rotation");
                    if (ryProp && ryProp.value !== undefined) origRotY = ryProp.value;
                    var rzProp = tg.property("ADBE Z Rotation") || tg.property("Z Rotation");
                    if (rzProp && rzProp.value !== undefined) origRotZ = rzProp.value;
                }

                var metaObj = {
                    C3D_TYPE: "ARC_CARD",
                    orig3D: is3D,
                    origParentName: (card.parent && card.parent.name) ? card.parent.name : null,
                    origParentIndex: (card.parent && card.parent.index) ? card.parent.index : null,
                    origPos: [origPos[0], origPos[1], origPos[2]],
                    origScale: [origScale[0], origScale[1], origScale[2]],
                    origOrient: [origOrient[0], origOrient[1], origOrient[2]],
                    origRotX: origRotX, origRotY: origRotY, origRotZ: origRotZ
                };
                
                // Append metadata safely without overwriting user comments
                var existingComment = card.comment || "";
                var cleanComment = removeMetadataFromComment(existingComment, META_ARC_PREFIX);
                card.comment = cleanComment + META_ARC_PREFIX + serializeMetadata(metaObj) + META_SUFFIX;
                card.parent = master;
            }

            var settings = { radius: radius, startAngle: startAngle, arcAngle: arcAngle, spacing: spacing, scale: scaleVal };
            applyArcLayout(comp, master, validLayers, settings);

            app.endUndoGroup();
            return true;

        } catch (err) {
            app.endUndoGroup();
            reportError("Operation failed during Create Arc:\n" + err.toString());
            return false;
        }
    }

    function updateArcCarousel(params, skipUndo) {
        var comp = getActiveComp();
        if (!comp) return reportError("No active composition found.", (typeof params !== "undefined" && params) ? (params.silent || params.isLivePreview) : false);

        var master = findArcMaster(comp);
        if (!master) return reportError("C3D_ARC_MASTER not found in active composition. Use CREATE ARC first.", (typeof params !== "undefined" && params) ? (params.silent || params.isLivePreview) : false);

        if (!skipUndo) app.beginUndoGroup("Update Arc Carousel – Motion by DK");

        try {
            var eRadius = getOrAddEffect(master, "ADBE Slider Control", "C3D Radius");
            var eAngle = getOrAddEffect(master, "ADBE Slider Control", "C3D Start Angle");
            var eArcAngle = getOrAddEffect(master, "ADBE Slider Control", "C3D Arc Angle");
            var eSpacing = getOrAddEffect(master, "ADBE Slider Control", "C3D Spacing");
            var eScale = getOrAddEffect(master, "ADBE Slider Control", "C3D Scale");
            var eAutoRot = getOrAddEffect(master, "ADBE Checkbox Control", "C3D Auto Rotate");
            var eSpeed = getOrAddEffect(master, "ADBE Slider Control", "C3D Rotation Speed");

            if (params.radius !== undefined) setEffectValue(eRadius, safeNumber(params.radius, DEFAULT_RADIUS, MIN_RADIUS));
            if (params.startAngle !== undefined) setEffectValue(eAngle, safeNumber(params.startAngle, DEFAULT_START_ANGLE));
            if (params.arcAngle !== undefined) setEffectValue(eArcAngle, safeNumber(params.arcAngle, DEFAULT_ARC_ANGLE, 10, 720));
            if (params.spacing !== undefined) setEffectValue(eSpacing, safeNumber(params.spacing, DEFAULT_ARC_SPACING, 0.1, 5.0));
            if (params.scale !== undefined) setEffectValue(eScale, safeNumber(params.scale, DEFAULT_SCALE, MIN_SCALE));
            if (params.autoRotate !== undefined) setEffectValue(eAutoRot, params.autoRotate ? 1 : 0);
            if (params.rotSpeed !== undefined) setEffectValue(eSpeed, safeNumber(params.rotSpeed, DEFAULT_ROT_SPEED));

            var radius = getEffectValue(eRadius, safeNumber(params.radius, DEFAULT_RADIUS, MIN_RADIUS));
            var startAngle = getEffectValue(eAngle, safeNumber(params.startAngle, DEFAULT_START_ANGLE));
            var arcAngle = getEffectValue(eArcAngle, safeNumber(params.arcAngle, DEFAULT_ARC_ANGLE, 10, 720));
            var spacing = getEffectValue(eSpacing, safeNumber(params.spacing, DEFAULT_ARC_SPACING, 0.1, 5.0));
            var scaleVal = getEffectValue(eScale, safeNumber(params.scale, DEFAULT_SCALE, MIN_SCALE));

            updateAutoRotateExpression(master);

            var cards = getArcCarouselCards(comp, master);
            var settings = { radius: radius, startAngle: startAngle, arcAngle: arcAngle, spacing: spacing, scale: scaleVal };
            applyArcLayout(comp, master, cards, settings);

            if (!skipUndo) app.endUndoGroup();
            return true;

        } catch (err) {
            if (!skipUndo) app.endUndoGroup();
            reportError("Operation failed during Update Arc:\n" + err.toString(), (typeof params !== "undefined" && params) ? (params.silent || params.isLivePreview) : false);
            return false;
        }
    }

    function resetArcCarousel() {
        var comp = getActiveComp();
        if (!comp) return false;

        app.beginUndoGroup("Reset Arc Carousel – Motion by DK");
        try {
            var defaults = {
                radius: DEFAULT_RADIUS,
                startAngle: DEFAULT_START_ANGLE,
                arcAngle: DEFAULT_ARC_ANGLE,
                spacing: DEFAULT_ARC_SPACING,
                scale: DEFAULT_SCALE,
                autoRotate: DEFAULT_AUTO_ROTATE,
                rotSpeed: DEFAULT_ROT_SPEED
            };

            var master = findArcMaster(comp);
            if (master) {
                updateArcCarousel(defaults, true); // skipUndo = true prevents nested undo groups!
            }
            app.endUndoGroup();
            return true;
        } catch (e) {
            app.endUndoGroup();
            return false;
        }
    }

    function deleteArcCarousel() {
        var comp = getActiveComp();
        if (!comp) return reportError("No active composition found.", (typeof params !== "undefined" && params) ? (params.silent || params.isLivePreview) : false);

        var master = findArcMaster(comp);
        var camera = findArcCamera(comp);
        if (!master && !camera) return reportError("No Arc Carousel controllers found in active composition.");

        app.beginUndoGroup("Delete Arc Carousel – Motion by DK");

        try {
            var cards = getArcCarouselCards(comp, master);
            var circleMaster = findCircleMaster(comp);
            var circleCamera = findCircleCamera(comp);
            var helixMaster = findHelixMaster(comp);
            var helixCamera = findHelixCamera(comp);

            for (var i = 0; i < cards.length; i++) {
                var card = cards[i];
                if (!card) continue;

                removeAllLayerExpressions(card);

                var metaObj = extractMetadataFromComment(card.comment, META_ARC_PREFIX);
                if (metaObj) {
                    card.comment = removeMetadataFromComment(card.comment, META_ARC_PREFIX);
                }

                var restoredParent = false;
                if (metaObj && metaObj.origParentName) {
                    try {
                        var pLayer = comp.layer(metaObj.origParentName);
                        // PREVENT RE-PARENTING TO CAROUSEL MASTERS OR CAMERAS
                        if (pLayer && pLayer !== master && pLayer !== camera && pLayer !== circleMaster && pLayer !== circleCamera && pLayer !== helixMaster && pLayer !== helixCamera) {
                            card.parent = pLayer;
                            restoredParent = true;
                        }
                    } catch (e1) {}
                }
                if (!restoredParent && metaObj && metaObj.origParentIndex) {
                    try {
                        var pLayerIdx = comp.layer(metaObj.origParentIndex);
                        if (pLayerIdx && pLayerIdx !== master && pLayerIdx !== camera && pLayerIdx !== circleMaster && pLayerIdx !== circleCamera && pLayerIdx !== helixMaster && pLayerIdx !== helixCamera) {
                            card.parent = pLayerIdx;
                            restoredParent = true;
                        }
                    } catch (e2) {}
                }
                if (!restoredParent) card.parent = null;

                if (metaObj) {
                    if (metaObj.origPos) setLayerPosition(card, metaObj.origPos[0], metaObj.origPos[1], metaObj.origPos[2]);
                    if (metaObj.origScale) setLayerScale(card, metaObj.origScale);
                    var tg = card.property("ADBE Transform Group") || card.property("Transform");
                    if (tg) {
                        if (metaObj.origOrient && tg.property("ADBE Orientation")) safeSetValue(tg.property("ADBE Orientation"), metaObj.origOrient);
                        if (metaObj.origRotX !== undefined && tg.property("ADBE X Rotation")) safeSetValue(tg.property("ADBE X Rotation"), metaObj.origRotX);
                        if (metaObj.origRotY !== undefined && tg.property("ADBE Y Rotation")) safeSetValue(tg.property("ADBE Y Rotation"), metaObj.origRotY);
                        if (metaObj.origRotZ !== undefined && tg.property("ADBE Z Rotation")) safeSetValue(tg.property("ADBE Z Rotation"), metaObj.origRotZ);
                    }
                    if (metaObj.orig3D !== undefined) { try { card.threeDLayer = metaObj.orig3D; } catch (e3D) {} }
                }
            }

            if (master) try { master.remove(); } catch (eRem1) {}
            if (camera) try { camera.remove(); } catch (eRem2) {}

            app.endUndoGroup();
            return true;

        } catch (err) {
            app.endUndoGroup();
            reportError("Operation failed during Delete Arc:\n" + err.toString());
            return false;
        }
    }

    // ------------------------------------------------------------------------
    // HELIX / SPIRAL CAROUSEL ENGINE (V1.0 - STRICT ISOLATION & SKIP UNDO SUPPORT)
    // ------------------------------------------------------------------------
    function findHelixMaster(comp) {
        if (!comp) return null;
        for (var i = 1; i <= comp.numLayers; i++) {
            var l = comp.layer(i);
            if (!l) continue;
            var comment = l.comment || "";
            if (l.name === HELIX_MASTER_NAME || comment.indexOf(TAG_HELIX_MASTER) !== -1) {
                return l;
            }
        }
        return null;
    }

    function findHelixCamera(comp) {
        if (!comp) return null;
        for (var i = 1; i <= comp.numLayers; i++) {
            var l = comp.layer(i);
            if (!l) continue;
            var comment = l.comment || "";
            if (l.name === HELIX_CAMERA_NAME || comment.indexOf(TAG_HELIX_CAMERA) !== -1) {
                return l;
            }
        }
        return null;
    }

    function setupHelixMasterNull(comp, radius, startAngle, vertSpacing, twist, scaleVal, autoRotate, rotSpeed) {
        if (!comp) return null;
        var master = findHelixMaster(comp);
        if (!master) {
            master = comp.layers.addNull();
            if (!master) return null;
            master.name = HELIX_MASTER_NAME;
            master.comment = TAG_HELIX_MASTER;
            master.guideLayer = true;
            master.label = 11;
        }

        try { master.threeDLayer = true; } catch (e) {}
        setLayerPosition(master, comp.width / 2, comp.height / 2, 0);

        setEffectValue(getOrAddEffect(master, "ADBE Slider Control", "C3D Radius"), safeNumber(radius, DEFAULT_RADIUS, MIN_RADIUS));
        setEffectValue(getOrAddEffect(master, "ADBE Slider Control", "C3D Start Angle"), safeNumber(startAngle, DEFAULT_START_ANGLE));
        setEffectValue(getOrAddEffect(master, "ADBE Slider Control", "C3D Vertical Spacing"), safeNumber(vertSpacing, DEFAULT_HELIX_VERT_SPACING, -500, 500));
        setEffectValue(getOrAddEffect(master, "ADBE Slider Control", "C3D Twist"), safeNumber(twist, DEFAULT_HELIX_TWIST, -1440, 1440));
        setEffectValue(getOrAddEffect(master, "ADBE Slider Control", "C3D Scale"), safeNumber(scaleVal, DEFAULT_SCALE, MIN_SCALE));
        setEffectValue(getOrAddEffect(master, "ADBE Checkbox Control", "C3D Auto Rotate"), autoRotate ? 1 : 0);
        setEffectValue(getOrAddEffect(master, "ADBE Slider Control", "C3D Rotation Speed"), safeNumber(rotSpeed, DEFAULT_ROT_SPEED));

        updateAutoRotateExpression(master);
        return master;
    }

    function setupHelixCamera(comp, masterNull, radius, vertSpacing, cardCount) {
        return null;
    }

    function getHelixCarouselCards(comp, masterNull) {
        var cards = [];
        if (!comp || !masterNull) return cards;

        for (var i = 1; i <= comp.numLayers; i++) {
            var l = comp.layer(i);
            if (!l) continue;
            var comment = l.comment || "";
            // STRICT FILTERING: Must be parented to Helix Master AND contain Helix metadata prefix
            if (l.parent === masterNull && comment.indexOf(META_HELIX_PREFIX) !== -1) {
                cards.push(l);
            }
        }
        return cards;
    }

    function applyHelixLayout(comp, masterNull, cards, settings) {
        if (!comp || !masterNull || !cards || cards.length === 0) return false;

        var radius = safeNumber(settings.radius, DEFAULT_RADIUS, MIN_RADIUS);
        var startAngle = safeNumber(settings.startAngle, DEFAULT_START_ANGLE);
        var vertSpacing = safeNumber(settings.vertSpacing, DEFAULT_HELIX_VERT_SPACING, -500, 500);
        var twist = safeNumber(settings.twist, DEFAULT_HELIX_TWIST, -1440, 1440);
        var scaleVal = safeNumber(settings.scale, DEFAULT_SCALE, MIN_SCALE);

        var totalCount = cards.length;

        for (var k = 0; k < totalCount; k++) {
            var card = cards[k];
            if (!card) continue;

            try { card.threeDLayer = true; } catch (e) {}

            var origScale = [100, 100, 100];
            var comment = card.comment || "";

            var metaObj = extractMetadataFromComment(comment, META_HELIX_PREFIX);
            if (metaObj && metaObj.origScale) {
                origScale = metaObj.origScale;
            }

            var t = (totalCount > 1) ? (k / (totalCount - 1)) : 0;
            var angleDeg = startAngle + (t * twist);
            var angleRad = angleDeg * Math.PI / 180;

            var x = Math.sin(angleRad) * radius;
            var z = Math.cos(angleRad) * radius;
            var y = (k - (totalCount - 1) / 2) * vertSpacing;

            var facingY = angleDeg + 180;

            var origX = (origScale && origScale[0] !== undefined) ? origScale[0] : 100;
            var origY = (origScale && origScale[1] !== undefined) ? origScale[1] : 100;
            var origZ = (origScale && origScale[2] !== undefined) ? origScale[2] : 100;

            var factor = scaleVal / 100;
            var finalScale = [origX * factor, origY * factor, origZ * factor];

            setLayerPosition(card, x, y, z);
            setLayerRotation(card, facingY);
            setLayerScale(card, finalScale);
        }

        return true;
    }

    function createHelixCarousel(params) {
        var comp = getActiveComp();
        if (!comp) {
            reportError("No active composition found. Please open a composition in After Effects.");
            return false;
        }

        var selected = comp.selectedLayers;
        if (!selected || selected.length === 0) {
            reportError("Please select at least 2 artwork layers in the active composition.");
            return false;
        }

        var validLayers = [];
        for (var i = 0; i < selected.length; i++) {
            var l = selected[i];
            if (!l) continue;
            if (l.name !== CIRCLE_MASTER_NAME && l.name !== CIRCLE_CAMERA_NAME &&
                l.name !== ARC_MASTER_NAME && l.name !== ARC_CAMERA_NAME &&
                l.name !== HELIX_MASTER_NAME && l.name !== HELIX_CAMERA_NAME) {
                validLayers.push(l);
            }
        }

        if (validLayers.length < 2) {
            reportError("Please select at least 2 artwork layers in the active composition.");
            return false;
        }

        if (findHelixMaster(comp)) {
            reportError("Helix Carousel already exists in this composition. Use UPDATE or DELETE.");
            return false;
        }

        app.beginUndoGroup("Create Helix Carousel – Motion by DK");

        try {
            var radius = safeNumber(params.radius, DEFAULT_RADIUS, MIN_RADIUS);
            var startAngle = safeNumber(params.startAngle, DEFAULT_START_ANGLE);
            var vertSpacing = safeNumber(params.vertSpacing, DEFAULT_HELIX_VERT_SPACING, -500, 500);
            var twist = safeNumber(params.twist, DEFAULT_HELIX_TWIST, -1440, 1440);
            var scaleVal = safeNumber(params.scale, DEFAULT_SCALE, MIN_SCALE);
            var autoRotate = params.autoRotate === true;
            var rotSpeed = safeNumber(params.rotSpeed, DEFAULT_ROT_SPEED);

            var master = setupHelixMasterNull(comp, radius, startAngle, vertSpacing, twist, scaleVal, autoRotate, rotSpeed);
            if (!master) {
                reportError("Operation failed during Create Helix: Unable to create Master Null controller.");
                app.endUndoGroup();
                return false;
            }

            var totalCount = validLayers.length;
            for (var j = 0; j < totalCount; j++) {
                var card = validLayers[j];
                var is3D = card.threeDLayer;
                var origPos = getLayerPosition(card);
                var tg = card.property("ADBE Transform Group") || card.property("Transform");
                var origScale = [100, 100, 100];
                var origOrient = [0, 0, 0];
                var origRotX = 0, origRotY = 0, origRotZ = 0;

                if (tg) {
                    var sProp = tg.property("ADBE Scale") || tg.property("Scale");
                    if (sProp && sProp.value) origScale = sProp.value;
                    var oProp = tg.property("ADBE Orientation") || tg.property("Orientation");
                    if (oProp && oProp.value) origOrient = oProp.value;
                    var rxProp = tg.property("ADBE X Rotation") || tg.property("X Rotation");
                    if (rxProp && rxProp.value !== undefined) origRotX = rxProp.value;
                    var ryProp = tg.property("ADBE Y Rotation") || tg.property("Y Rotation");
                    if (ryProp && ryProp.value !== undefined) origRotY = ryProp.value;
                    var rzProp = tg.property("ADBE Z Rotation") || tg.property("Z Rotation");
                    if (rzProp && rzProp.value !== undefined) origRotZ = rzProp.value;
                }

                var metaObj = {
                    C3D_TYPE: "HELIX_CARD",
                    orig3D: is3D,
                    origParentName: (card.parent && card.parent.name) ? card.parent.name : null,
                    origParentIndex: (card.parent && card.parent.index) ? card.parent.index : null,
                    origPos: [origPos[0], origPos[1], origPos[2]],
                    origScale: [origScale[0], origScale[1], origScale[2]],
                    origOrient: [origOrient[0], origOrient[1], origOrient[2]],
                    origRotX: origRotX, origRotY: origRotY, origRotZ: origRotZ
                };
                
                var existingComment = card.comment || "";
                var cleanComment = removeMetadataFromComment(existingComment, META_HELIX_PREFIX);
                card.comment = cleanComment + META_HELIX_PREFIX + serializeMetadata(metaObj) + META_SUFFIX;
                card.parent = master;
            }

            var settings = { radius: radius, startAngle: startAngle, vertSpacing: vertSpacing, twist: twist, scale: scaleVal };
            applyHelixLayout(comp, master, validLayers, settings);

            app.endUndoGroup();
            return true;

        } catch (err) {
            app.endUndoGroup();
            reportError("Operation failed during Create Helix:\n" + err.toString());
            return false;
        }
    }

    function updateHelixCarousel(params, skipUndo) {
        var comp = getActiveComp();
        if (!comp) return reportError("No active composition found.", (typeof params !== "undefined" && params) ? (params.silent || params.isLivePreview) : false);

        var master = findHelixMaster(comp);
        if (!master) return reportError("C3D_HELIX_MASTER not found in active composition. Use CREATE HELIX first.", (typeof params !== "undefined" && params) ? (params.silent || params.isLivePreview) : false);

        if (!skipUndo) app.beginUndoGroup("Update Helix Carousel – Motion by DK");

        try {
            var eRadius = getOrAddEffect(master, "ADBE Slider Control", "C3D Radius");
            var eAngle = getOrAddEffect(master, "ADBE Slider Control", "C3D Start Angle");
            var eVertSpacing = getOrAddEffect(master, "ADBE Slider Control", "C3D Vertical Spacing");
            var eTwist = getOrAddEffect(master, "ADBE Slider Control", "C3D Twist");
            var eScale = getOrAddEffect(master, "ADBE Slider Control", "C3D Scale");
            var eAutoRot = getOrAddEffect(master, "ADBE Checkbox Control", "C3D Auto Rotate");
            var eSpeed = getOrAddEffect(master, "ADBE Slider Control", "C3D Rotation Speed");

            if (params.radius !== undefined) setEffectValue(eRadius, safeNumber(params.radius, DEFAULT_RADIUS, MIN_RADIUS));
            if (params.startAngle !== undefined) setEffectValue(eAngle, safeNumber(params.startAngle, DEFAULT_START_ANGLE));
            if (params.vertSpacing !== undefined) setEffectValue(eVertSpacing, safeNumber(params.vertSpacing, DEFAULT_HELIX_VERT_SPACING, -500, 500));
            if (params.twist !== undefined) setEffectValue(eTwist, safeNumber(params.twist, DEFAULT_HELIX_TWIST, -1440, 1440));
            if (params.scale !== undefined) setEffectValue(eScale, safeNumber(params.scale, DEFAULT_SCALE, MIN_SCALE));
            if (params.autoRotate !== undefined) setEffectValue(eAutoRot, params.autoRotate ? 1 : 0);
            if (params.rotSpeed !== undefined) setEffectValue(eSpeed, safeNumber(params.rotSpeed, DEFAULT_ROT_SPEED));

            var radius = getEffectValue(eRadius, safeNumber(params.radius, DEFAULT_RADIUS, MIN_RADIUS));
            var startAngle = getEffectValue(eAngle, safeNumber(params.startAngle, DEFAULT_START_ANGLE));
            var vertSpacing = getEffectValue(eVertSpacing, safeNumber(params.vertSpacing, DEFAULT_HELIX_VERT_SPACING, -500, 500));
            var twist = getEffectValue(eTwist, safeNumber(params.twist, DEFAULT_HELIX_TWIST, -1440, 1440));
            var scaleVal = getEffectValue(eScale, safeNumber(params.scale, DEFAULT_SCALE, MIN_SCALE));

            updateAutoRotateExpression(master);

            var cards = getHelixCarouselCards(comp, master);
            var settings = { radius: radius, startAngle: startAngle, vertSpacing: vertSpacing, twist: twist, scale: scaleVal };
            applyHelixLayout(comp, master, cards, settings);

            if (!skipUndo) app.endUndoGroup();
            return true;

        } catch (err) {
            if (!skipUndo) app.endUndoGroup();
            reportError("Operation failed during Update Helix:\n" + err.toString(), (typeof params !== "undefined" && params) ? (params.silent || params.isLivePreview) : false);
            return false;
        }
    }

    function resetHelixCarousel() {
        var comp = getActiveComp();
        if (!comp) return false;

        app.beginUndoGroup("Reset Helix Carousel – Motion by DK");
        try {
            var defaults = {
                radius: DEFAULT_RADIUS,
                startAngle: DEFAULT_START_ANGLE,
                vertSpacing: DEFAULT_HELIX_VERT_SPACING,
                twist: DEFAULT_HELIX_TWIST,
                scale: DEFAULT_SCALE,
                autoRotate: DEFAULT_AUTO_ROTATE,
                rotSpeed: DEFAULT_ROT_SPEED
            };

            var master = findHelixMaster(comp);
            if (master) {
                updateHelixCarousel(defaults, true);
            }
            app.endUndoGroup();
            return true;
        } catch (e) {
            app.endUndoGroup();
            return false;
        }
    }

    function deleteHelixCarousel() {
        var comp = getActiveComp();
        if (!comp) return reportError("No active composition found.", (typeof params !== "undefined" && params) ? (params.silent || params.isLivePreview) : false);

        var master = findHelixMaster(comp);
        var camera = findHelixCamera(comp);
        if (!master && !camera) return reportError("No Helix Carousel controllers found in active composition.");

        app.beginUndoGroup("Delete Helix Carousel – Motion by DK");

        try {
            var cards = getHelixCarouselCards(comp, master);
            var circleMaster = findCircleMaster(comp);
            var circleCamera = findCircleCamera(comp);
            var arcMaster = findArcMaster(comp);
            var arcCamera = findArcCamera(comp);

            for (var i = 0; i < cards.length; i++) {
                var card = cards[i];
                if (!card) continue;

                removeAllLayerExpressions(card);

                var metaObj = extractMetadataFromComment(card.comment, META_HELIX_PREFIX);
                if (metaObj) {
                    card.comment = removeMetadataFromComment(card.comment, META_HELIX_PREFIX);
                }

                var restoredParent = false;
                if (metaObj && metaObj.origParentName) {
                    try {
                        var pLayer = comp.layer(metaObj.origParentName);
                        // PREVENT RE-PARENTING TO CAROUSEL MASTERS OR CAMERAS
                        if (pLayer && pLayer !== master && pLayer !== camera && pLayer !== circleMaster && pLayer !== circleCamera && pLayer !== arcMaster && pLayer !== arcCamera) {
                            card.parent = pLayer;
                            restoredParent = true;
                        }
                    } catch (e1) {}
                }
                if (!restoredParent && metaObj && metaObj.origParentIndex) {
                    try {
                        var pLayerIdx = comp.layer(metaObj.origParentIndex);
                        if (pLayerIdx && pLayerIdx !== master && pLayerIdx !== camera && pLayerIdx !== circleMaster && pLayerIdx !== circleCamera && pLayerIdx !== arcMaster && pLayerIdx !== arcCamera) {
                            card.parent = pLayerIdx;
                            restoredParent = true;
                        }
                    } catch (e2) {}
                }
                if (!restoredParent) card.parent = null;

                if (metaObj) {
                    if (metaObj.origPos) setLayerPosition(card, metaObj.origPos[0], metaObj.origPos[1], metaObj.origPos[2]);
                    if (metaObj.origScale) setLayerScale(card, metaObj.origScale);
                    var tg = card.property("ADBE Transform Group") || card.property("Transform");
                    if (tg) {
                        if (metaObj.origOrient && tg.property("ADBE Orientation")) safeSetValue(tg.property("ADBE Orientation"), metaObj.origOrient);
                        if (metaObj.origRotX !== undefined && tg.property("ADBE X Rotation")) safeSetValue(tg.property("ADBE X Rotation"), metaObj.origRotX);
                        if (metaObj.origRotY !== undefined && tg.property("ADBE Y Rotation")) safeSetValue(tg.property("ADBE Y Rotation"), metaObj.origRotY);
                        if (metaObj.origRotZ !== undefined && tg.property("ADBE Z Rotation")) safeSetValue(tg.property("ADBE Z Rotation"), metaObj.origRotZ);
                    }
                    if (metaObj.orig3D !== undefined) { try { card.threeDLayer = metaObj.orig3D; } catch (e3D) {} }
                }
            }

            if (master) try { master.remove(); } catch (eRem1) {}
            if (camera) try { camera.remove(); } catch (eRem2) {}

            app.endUndoGroup();
            return true;

        } catch (err) {
            app.endUndoGroup();
            reportError("Operation failed during Delete Helix:\n" + err.toString());
            return false;
        }
    }

    // ------------------------------------------------------------------------
    // EASY 3D CAROUSEL ENGINE (V1.0 - DEPTH SCALING, OPACITY FADE & STEP ANIMATION)
    // ------------------------------------------------------------------------
    function findEasyMaster(comp) {
        if (!comp) return null;
        for (var i = 1; i <= comp.numLayers; i++) {
            var l = comp.layer(i);
            if (!l) continue;
            var comment = l.comment || "";
            if (l.name === EASY_MASTER_NAME || comment.indexOf(TAG_EASY_MASTER) !== -1) {
                return l;
            }
        }
        return null;
    }

    function findEasyCamera(comp) {
        if (!comp) return null;
        for (var i = 1; i <= comp.numLayers; i++) {
            var l = comp.layer(i);
            if (!l) continue;
            var comment = l.comment || "";
            if (l.name === EASY_CAMERA_NAME || comment.indexOf(TAG_EASY_CAMERA) !== -1) {
                return l;
            }
        }
        return null;
    }

    function setupEasyMasterNull(comp, radius, startAngle, scaleVal, backScale, scaleExp, backOpac, opacExp, isAnim, pauseDur, transDur, isVertMode, rotX, rotY, rotZ, autoRotate, rotSpeed) {
        if (!comp) return null;
        var master = findEasyMaster(comp);
        if (!master) {
            master = comp.layers.addNull();
            if (!master) return null;
            master.name = EASY_MASTER_NAME;
            master.comment = TAG_EASY_MASTER;
            master.guideLayer = true;
            master.label = 12;
        }

        try { master.threeDLayer = true; } catch (e) {}
        setLayerPosition(master, comp.width / 2, comp.height / 2, 0);

        setEffectValue(getOrAddEffect(master, "ADBE Slider Control", "C3D Radius"), safeNumber(radius, DEFAULT_RADIUS, MIN_RADIUS));
        setEffectValue(getOrAddEffect(master, "ADBE Slider Control", "C3D Start Angle"), safeNumber(startAngle, DEFAULT_START_ANGLE));
        setEffectValue(getOrAddEffect(master, "ADBE Slider Control", "C3D Scale"), safeNumber(scaleVal, DEFAULT_SCALE, MIN_SCALE));
        setEffectValue(getOrAddEffect(master, "ADBE Slider Control", "C3D Back Scale"), safeNumber(backScale, DEFAULT_EASY_BACK_SCALE, 0, 100));
        setEffectValue(getOrAddEffect(master, "ADBE Slider Control", "C3D Scale Exponent"), safeNumber(scaleExp, DEFAULT_EASY_SCALE_EXP, 0.1, 5.0));
        setEffectValue(getOrAddEffect(master, "ADBE Slider Control", "C3D Back Opacity"), safeNumber(backOpac, DEFAULT_EASY_BACK_OPACITY, 0, 100));
        setEffectValue(getOrAddEffect(master, "ADBE Slider Control", "C3D Opacity Exponent"), safeNumber(opacExp, DEFAULT_EASY_OPAC_EXP, 0.1, 5.0));
        setEffectValue(getOrAddEffect(master, "ADBE Checkbox Control", "C3D Animated"), isAnim ? 1 : 0);
        setEffectValue(getOrAddEffect(master, "ADBE Slider Control", "C3D Pause Duration"), safeNumber(pauseDur, DEFAULT_EASY_PAUSE_DUR, 0.1, 10.0));
        setEffectValue(getOrAddEffect(master, "ADBE Slider Control", "C3D Transition Duration"), safeNumber(transDur, DEFAULT_EASY_TRANS_DUR, 0.1, 10.0));
        setEffectValue(getOrAddEffect(master, "ADBE Checkbox Control", "C3D Vertical Mode"), isVertMode ? 1 : 0);
        setEffectValue(getOrAddEffect(master, "ADBE Slider Control", "C3D X Rotation"), safeNumber(rotX, DEFAULT_ROT_X));
        setEffectValue(getOrAddEffect(master, "ADBE Slider Control", "C3D Y Rotation"), safeNumber(rotY, DEFAULT_ROT_Y));
        setEffectValue(getOrAddEffect(master, "ADBE Slider Control", "C3D Z Rotation"), safeNumber(rotZ, DEFAULT_ROT_Z));
        setEffectValue(getOrAddEffect(master, "ADBE Checkbox Control", "C3D Auto Rotate"), autoRotate ? 1 : 0);
        setEffectValue(getOrAddEffect(master, "ADBE Slider Control", "C3D Rotation Speed"), safeNumber(rotSpeed, DEFAULT_ROT_SPEED));

        return master;
    }

    function setupEasyCamera(comp, masterNull, radius) {
        return null;
    }

    function getEasyCarouselCards(comp, masterNull) {
        var cards = [];
        if (!comp || !masterNull) return cards;

        for (var i = 1; i <= comp.numLayers; i++) {
            var l = comp.layer(i);
            if (!l) continue;
            var comment = l.comment || "";
            // STRICT FILTERING: Must be parented to Easy Master AND contain Easy metadata prefix
            if (l.parent === masterNull && comment.indexOf(META_EASY_PREFIX) !== -1) {
                cards.push(l);
            }
        }
        return cards;
    }

    function applyEasyLayout(comp, masterNull, cards, settings) {
        if (!comp || !masterNull || !cards || cards.length === 0) return false;

        var radius = safeNumber(settings.radius, DEFAULT_RADIUS, MIN_RADIUS);
        var isAnim = settings.isAnim === true;

        var totalCount = cards.length;

        for (var k = 0; k < totalCount; k++) {
            var card = cards[k];
            if (!card) continue;

            try { card.threeDLayer = true; } catch (e) {}
            card.parent = masterNull;

            // Position expression (3D Trig Spacing around circle)
            var posExpr = "var num = " + totalCount + ";\n" +
                          "var idx = " + k + ";\n" +
                          "var r = parent.effect('C3D Radius')(1).value;\n" +
                          "var startA = parent.effect('C3D Start Angle')(1).value;\n" +
                          "var angle = degreesToRadians(startA + idx * (360/num));\n" +
                          "var x = Math.sin(angle) * r;\n" +
                          "var z = -Math.cos(angle) * r;\n" +
                          "[x, 0, z];";
            setCardPositionExpression(card, posExpr);

            // Counter-Rotations (flat facing camera)
            var tgCard = card.property("ADBE Transform Group") || card.property("Transform");
            if (tgCard) {
                var oProp = tgCard.property("ADBE Orientation") || tgCard.property("Orientation");
                if (oProp) safeSetValue(oProp, [0, 0, 0]);
                var rxProp = tgCard.property("ADBE X Rotation") || tgCard.property("X Rotation");
                if (rxProp) safeSetExpression(rxProp, "-parent.transform.xRotation;");
                var ryProp = tgCard.property("ADBE Y Rotation") || tgCard.property("Y Rotation");
                if (ryProp) safeSetExpression(ryProp, "-parent.transform.yRotation;");
                var rzProp = tgCard.property("ADBE Z Rotation") || tgCard.property("Z Rotation");
                if (rzProp) safeSetExpression(rzProp, "-parent.transform.zRotation;");

                // Depth Scale Expression
                var scaleExpr = "var ctrl = parent;\n" +
                                "var gS = ctrl.effect('C3D Scale')(1).value/100;\n" +
                                "var bS = ctrl.effect('C3D Back Scale')('Slider').value/100;\n" +
                                "var sExp = ctrl.effect('C3D Scale Exponent')('Slider').value;\n" +
                                "var r = ctrl.effect('C3D Radius')(1).value;\n" +
                                "var wP = toWorld(anchorPoint)[2];\n" +
                                "var cP = ctrl.toWorld(ctrl.anchorPoint)[2];\n" +
                                "var depth = wP - cP;\n" +
                                "if (r == 0) { var norm = 0; } else { var norm = Math.max(0, Math.min(1, (depth + r) / (2 * r))); }\n" +
                                "var factor = gS * Math.pow((1 - norm) + norm * bS, sExp);\n" +
                                "[value[0]*factor, value[1]*factor, 100];";
                var scProp = tgCard.property("ADBE Scale") || tgCard.property("Scale");
                if (scProp) safeSetExpression(scProp, scaleExpr);

                // Depth Opacity Expression
                var opacExpr = "var ctrl = parent;\n" +
                               "var bO = ctrl.effect('C3D Back Opacity')('Slider').value/100;\n" +
                               "var oExp = ctrl.effect('C3D Opacity Exponent')('Slider').value;\n" +
                               "var r = ctrl.effect('C3D Radius')(1).value;\n" +
                               "var wP = toWorld(anchorPoint)[2];\n" +
                               "var cP = ctrl.toWorld(ctrl.anchorPoint)[2];\n" +
                               "var depth = wP - cP;\n" +
                               "if (r == 0) { var norm = 0; } else { var norm = Math.max(0, Math.min(1, (depth + r) / (2 * r))); }\n" +
                               "var opacFactor = Math.pow((1 - norm) + norm * bO, oExp);\n" +
                               "value * opacFactor;";
                var opProp = tgCard.property("ADBE Opacity") || tgCard.property("Opacity");
                if (opProp) safeSetExpression(opProp, opacExpr);
            }
        }

        // Master Null Expressions
        var tgMaster = masterNull.property("ADBE Transform Group") || masterNull.property("Transform");
        if (tgMaster) {
            var zRotM = tgMaster.property("ADBE Z Rotation") || tgMaster.property("Z Rotation");
            if (zRotM) safeSetExpression(zRotM, "if(effect('C3D Vertical Mode')('Checkbox').value == 1) { 90; } else { effect('C3D Z Rotation')(1).value; }");

            var yRotM = tgMaster.property("ADBE Y Rotation") || tgMaster.property("Y Rotation");
            if (yRotM) {
                if (isAnim) {
                    var yRotExpr = EXPR_OWNERSHIP_MARKER + "\n" +
                                   "var userRot = effect('C3D Y Rotation')(1).value;\n" +
                                   "var autoRot = effect('C3D Auto Rotate')(1).value;\n" +
                                   "var rotSpeed = effect('C3D Rotation Speed')(1).value;\n" +
                                   "if (autoRot == 1 || autoRot == true) {\n" +
                                   "    var p = effect('C3D Pause Duration')('Slider').value;\n" +
                                   "    var t = effect('C3D Transition Duration')('Slider').value;\n" +
                                   "    var rotAmt = 360 / " + totalCount + ";\n" +
                                   "    var cycle = p + t;\n" +
                                   "    if (cycle == 0) cycle = 0.001;\n" +
                                   "    var step = Math.floor(time / cycle);\n" +
                                   "    var rem = time % cycle;\n" +
                                   "    var curRot = step * rotAmt;\n" +
                                   "    if (rem > p) { curRot += ease(rem, p, cycle, 0, rotAmt); }\n" +
                                   "    userRot + curRot + (time * rotSpeed);\n" +
                                   "} else {\n" +
                                   "    userRot;\n" +
                                   "}";
                    safeSetExpression(yRotM, yRotExpr);
                } else {
                    updateAutoRotateExpression(masterNull);
                }
            }
        }

        return true;
    }

    function createEasyCarousel(params) {
        var comp = getActiveComp();
        if (!comp) {
            reportError("No active composition found. Please open a composition in After Effects.");
            return false;
        }

        var selected = comp.selectedLayers;
        if (!selected || selected.length === 0) {
            reportError("Please select at least 2 artwork layers in the active composition.");
            return false;
        }

        var validLayers = [];
        for (var i = 0; i < selected.length; i++) {
            var l = selected[i];
            if (!l) continue;
            if (l.name !== CIRCLE_MASTER_NAME && l.name !== CIRCLE_CAMERA_NAME &&
                l.name !== ARC_MASTER_NAME && l.name !== ARC_CAMERA_NAME &&
                l.name !== HELIX_MASTER_NAME && l.name !== HELIX_CAMERA_NAME &&
                l.name !== EASY_MASTER_NAME && l.name !== EASY_CAMERA_NAME &&
                l.name !== SPHERE_MASTER_NAME && l.name !== SPHERE_CAMERA_NAME) {
                validLayers.push(l);
            }
        }

        if (validLayers.length < 2) {
            reportError("Please select at least 2 artwork layers in the active composition.");
            return false;
        }

        if (findEasyMaster(comp)) {
            reportError("Easy 3D Carousel already exists in this composition. Use UPDATE or DELETE.");
            return false;
        }

        app.beginUndoGroup("Create Easy 3D Carousel – Motion by DK");

        try {
            var radius = safeNumber(params.radius, DEFAULT_RADIUS, MIN_RADIUS);
            var startAngle = safeNumber(params.startAngle, DEFAULT_START_ANGLE);
            var scaleVal = safeNumber(params.scale, DEFAULT_SCALE, MIN_SCALE);
            var backScale = safeNumber(params.backScale, DEFAULT_EASY_BACK_SCALE, 0, 100);
            var scaleExp = safeNumber(params.scaleExp, DEFAULT_EASY_SCALE_EXP, 0.1, 5.0);
            var backOpac = safeNumber(params.backOpac, DEFAULT_EASY_BACK_OPACITY, 0, 100);
            var opacExp = safeNumber(params.opacExp, DEFAULT_EASY_OPAC_EXP, 0.1, 5.0);
            var isAnim = params.isAnim === true;
            var pauseDur = safeNumber(params.pauseDur, DEFAULT_EASY_PAUSE_DUR, 0.1, 10.0);
            var transDur = safeNumber(params.transDur, DEFAULT_EASY_TRANS_DUR, 0.1, 10.0);
            var isVertMode = params.isVertMode === true;
            var rotX = safeNumber(params.rotX, DEFAULT_ROT_X);
            var rotY = safeNumber(params.rotY, DEFAULT_ROT_Y);
            var rotZ = safeNumber(params.rotZ, DEFAULT_ROT_Z);
            var autoRotate = params.autoRotate === true;
            var rotSpeed = safeNumber(params.rotSpeed, DEFAULT_ROT_SPEED);

            var master = setupEasyMasterNull(comp, radius, startAngle, scaleVal, backScale, scaleExp, backOpac, opacExp, isAnim, pauseDur, transDur, isVertMode, rotX, rotY, rotZ, autoRotate, rotSpeed);
            if (!master) {
                reportError("Operation failed during Create Easy 3D: Unable to create Master Null controller.");
                app.endUndoGroup();
                return false;
            }

            var totalCount = validLayers.length;
            for (var j = 0; j < totalCount; j++) {
                var card = validLayers[j];
                var is3D = card.threeDLayer;
                var origPos = getLayerPosition(card);
                var tg = card.property("ADBE Transform Group") || card.property("Transform");
                var origScale = [100, 100, 100];
                var origOrient = [0, 0, 0];
                var origRotX = 0, origRotY = 0, origRotZ = 0;

                if (tg) {
                    var sProp = tg.property("ADBE Scale") || tg.property("Scale");
                    if (sProp && sProp.value) origScale = sProp.value;
                    var oProp = tg.property("ADBE Orientation") || tg.property("Orientation");
                    if (oProp && oProp.value) origOrient = oProp.value;
                    var rxProp = tg.property("ADBE X Rotation") || tg.property("X Rotation");
                    if (rxProp && rxProp.value !== undefined) origRotX = rxProp.value;
                    var ryProp = tg.property("ADBE Y Rotation") || tg.property("Y Rotation");
                    if (ryProp && ryProp.value !== undefined) origRotY = ryProp.value;
                    var rzProp = tg.property("ADBE Z Rotation") || tg.property("Z Rotation");
                    if (rzProp && rzProp.value !== undefined) origRotZ = rzProp.value;
                }

                var metaObj = {
                    C3D_TYPE: "EASY_CARD",
                    orig3D: is3D,
                    origParentName: (card.parent && card.parent.name) ? card.parent.name : null,
                    origParentIndex: (card.parent && card.parent.index) ? card.parent.index : null,
                    origPos: [origPos[0], origPos[1], origPos[2]],
                    origScale: [origScale[0], origScale[1], origScale[2]],
                    origOrient: [origOrient[0], origOrient[1], origOrient[2]],
                    origRotX: origRotX, origRotY: origRotY, origRotZ: origRotZ
                };
                
                var existingComment = card.comment || "";
                var cleanComment = removeMetadataFromComment(existingComment, META_EASY_PREFIX);
                card.comment = cleanComment + META_EASY_PREFIX + serializeMetadata(metaObj) + META_SUFFIX;
                card.parent = master;
            }

            var settings = { radius: radius, startAngle: startAngle, scale: scaleVal, isAnim: isAnim };
            applyEasyLayout(comp, master, validLayers, settings);

            app.endUndoGroup();
            return true;

        } catch (err) {
            app.endUndoGroup();
            reportError("Operation failed during Create Easy 3D:\n" + err.toString());
            return false;
        }
    }

    function updateEasyCarousel(params, skipUndo) {
        var comp = getActiveComp();
        if (!comp) return reportError("No active composition found.", params && (params.silent || params.isLivePreview));

        var master = findEasyMaster(comp);
        if (!master) return reportError("C3D_EASY_MASTER not found in active composition. Use CREATE EASY 3D first.", params && (params.silent || params.isLivePreview));

        if (params && (params.silent || params.isLivePreview)) skipUndo = true;
        if (!skipUndo) app.beginUndoGroup("Update Easy 3D Carousel – Motion by DK");

        try {
            var eRadius = getOrAddEffect(master, "ADBE Slider Control", "C3D Radius");
            var eAngle = getOrAddEffect(master, "ADBE Slider Control", "C3D Start Angle");
            var eScale = getOrAddEffect(master, "ADBE Slider Control", "C3D Scale");
            var eBackScale = getOrAddEffect(master, "ADBE Slider Control", "C3D Back Scale");
            var eScaleExp = getOrAddEffect(master, "ADBE Slider Control", "C3D Scale Exponent");
            var eBackOpac = getOrAddEffect(master, "ADBE Slider Control", "C3D Back Opacity");
            var eOpacExp = getOrAddEffect(master, "ADBE Slider Control", "C3D Opacity Exponent");
            var eAnim = getOrAddEffect(master, "ADBE Checkbox Control", "C3D Animated");
            var ePause = getOrAddEffect(master, "ADBE Slider Control", "C3D Pause Duration");
            var eTrans = getOrAddEffect(master, "ADBE Slider Control", "C3D Transition Duration");
            var eVertMode = getOrAddEffect(master, "ADBE Checkbox Control", "C3D Vertical Mode");
            var eRotX = getOrAddEffect(master, "ADBE Slider Control", "C3D X Rotation");
            var eRotY = getOrAddEffect(master, "ADBE Slider Control", "C3D Y Rotation");
            var eRotZ = getOrAddEffect(master, "ADBE Slider Control", "C3D Z Rotation");
            var eAutoRot = getOrAddEffect(master, "ADBE Checkbox Control", "C3D Auto Rotate");
            var eSpeed = getOrAddEffect(master, "ADBE Slider Control", "C3D Rotation Speed");

            if (params.radius !== undefined) setEffectValue(eRadius, safeNumber(params.radius, DEFAULT_RADIUS, MIN_RADIUS));
            if (params.startAngle !== undefined) setEffectValue(eAngle, safeNumber(params.startAngle, DEFAULT_START_ANGLE));
            if (params.scale !== undefined) setEffectValue(eScale, safeNumber(params.scale, DEFAULT_SCALE, MIN_SCALE));
            if (params.backScale !== undefined) setEffectValue(eBackScale, safeNumber(params.backScale, DEFAULT_EASY_BACK_SCALE, 0, 100));
            if (params.scaleExp !== undefined) setEffectValue(eScaleExp, safeNumber(params.scaleExp, DEFAULT_EASY_SCALE_EXP, 0.1, 5.0));
            if (params.backOpac !== undefined) setEffectValue(eBackOpac, safeNumber(params.backOpac, DEFAULT_EASY_BACK_OPACITY, 0, 100));
            if (params.opacExp !== undefined) setEffectValue(eOpacExp, safeNumber(params.opacExp, DEFAULT_EASY_OPAC_EXP, 0.1, 5.0));
            if (params.isAnim !== undefined) setEffectValue(eAnim, params.isAnim ? 1 : 0);
            if (params.pauseDur !== undefined) setEffectValue(ePause, safeNumber(params.pauseDur, DEFAULT_EASY_PAUSE_DUR, 0.1, 10.0));
            if (params.transDur !== undefined) setEffectValue(eTrans, safeNumber(params.transDur, DEFAULT_EASY_TRANS_DUR, 0.1, 10.0));
            if (params.isVertMode !== undefined) setEffectValue(eVertMode, params.isVertMode ? 1 : 0);
            if (params.rotX !== undefined) setEffectValue(eRotX, safeNumber(params.rotX, DEFAULT_ROT_X));
            if (params.rotY !== undefined) setEffectValue(eRotY, safeNumber(params.rotY, DEFAULT_ROT_Y));
            if (params.rotZ !== undefined) setEffectValue(eRotZ, safeNumber(params.rotZ, DEFAULT_ROT_Z));
            if (params.autoRotate !== undefined) setEffectValue(eAutoRot, params.autoRotate ? 1 : 0);
            if (params.rotSpeed !== undefined) setEffectValue(eSpeed, safeNumber(params.rotSpeed, DEFAULT_ROT_SPEED));

            var radius = getEffectValue(eRadius, safeNumber(params.radius, DEFAULT_RADIUS, MIN_RADIUS));
            var startAngle = getEffectValue(eAngle, safeNumber(params.startAngle, DEFAULT_START_ANGLE));
            var scaleVal = getEffectValue(eScale, safeNumber(params.scale, DEFAULT_SCALE, MIN_SCALE));
            var isAnim = (getEffectValue(eAnim, 0) === 1);

            var cards = getEasyCarouselCards(comp, master);
            var settings = { radius: radius, startAngle: startAngle, scale: scaleVal, isAnim: isAnim };
            applyEasyLayout(comp, master, cards, settings);

            if (!skipUndo) app.endUndoGroup();
            return true;

        } catch (err) {
            if (!skipUndo) app.endUndoGroup();
            reportError("Operation failed during Update Easy 3D:\n" + err.toString(), (typeof params !== "undefined" && params) ? (params.silent || params.isLivePreview) : false);
            return false;
        }
    }

    function resetEasyCarousel() {
        var comp = getActiveComp();
        if (!comp) return false;

        app.beginUndoGroup("Reset Easy 3D Carousel – Motion by DK");
        try {
            var defaults = {
                radius: DEFAULT_RADIUS,
                startAngle: DEFAULT_START_ANGLE,
                scale: DEFAULT_SCALE,
                backScale: DEFAULT_EASY_BACK_SCALE,
                scaleExp: DEFAULT_EASY_SCALE_EXP,
                backOpac: DEFAULT_EASY_BACK_OPACITY,
                opacExp: DEFAULT_EASY_OPAC_EXP,
                isAnim: false,
                pauseDur: DEFAULT_EASY_PAUSE_DUR,
                transDur: DEFAULT_EASY_TRANS_DUR,
                isVertMode: false,
                autoRotate: DEFAULT_AUTO_ROTATE,
                rotSpeed: DEFAULT_ROT_SPEED
            };

            var master = findEasyMaster(comp);
            if (master) {
                updateEasyCarousel(defaults, true);
            }
            app.endUndoGroup();
            return true;
        } catch (e) {
            app.endUndoGroup();
            return false;
        }
    }

    function deleteEasyCarousel() {
        var comp = getActiveComp();
        if (!comp) return reportError("No active composition found.", (typeof params !== "undefined" && params) ? (params.silent || params.isLivePreview) : false);

        var master = findEasyMaster(comp);
        var camera = findEasyCamera(comp);
        if (!master && !camera) return reportError("No Easy 3D Carousel controllers found in active composition.");

        app.beginUndoGroup("Delete Easy 3D Carousel – Motion by DK");

        try {
            var cards = getEasyCarouselCards(comp, master);
            var circleMaster = findCircleMaster(comp);
            var circleCamera = findCircleCamera(comp);
            var arcMaster = findArcMaster(comp);
            var arcCamera = findArcCamera(comp);
            var helixMaster = findHelixMaster(comp);
            var helixCamera = findHelixCamera(comp);

            for (var i = 0; i < cards.length; i++) {
                var card = cards[i];
                if (!card) continue;

                removeAllLayerExpressions(card);

                var metaObj = extractMetadataFromComment(card.comment, META_EASY_PREFIX);
                if (metaObj) {
                    card.comment = removeMetadataFromComment(card.comment, META_EASY_PREFIX);
                }

                // Clear Expressions set by Easy 3D layout
                try {
                    var tgCard = card.property("ADBE Transform Group") || card.property("Transform");
                    if (tgCard) {
                        safeSetExpression(tgCard.property("ADBE Position"), "");
                        safeSetExpression(tgCard.property("ADBE X Rotation"), "");
                        safeSetExpression(tgCard.property("ADBE Y Rotation"), "");
                        safeSetExpression(tgCard.property("ADBE Z Rotation"), "");
                        safeSetExpression(tgCard.property("ADBE Scale"), "");
                        safeSetExpression(tgCard.property("ADBE Opacity"), "");
                    }
                } catch (eExpr) {}

                var restoredParent = false;
                if (metaObj && metaObj.origParentName) {
                    try {
                        var pLayer = comp.layer(metaObj.origParentName);
                        // PREVENT RE-PARENTING TO CAROUSEL MASTERS OR CAMERAS
                        if (pLayer && pLayer !== master && pLayer !== camera && pLayer !== circleMaster && pLayer !== circleCamera && pLayer !== arcMaster && pLayer !== arcCamera && pLayer !== helixMaster && pLayer !== helixCamera) {
                            card.parent = pLayer;
                            restoredParent = true;
                        }
                    } catch (e1) {}
                }
                if (!restoredParent && metaObj && metaObj.origParentIndex) {
                    try {
                        var pLayerIdx = comp.layer(metaObj.origParentIndex);
                        if (pLayerIdx && pLayerIdx !== master && pLayerIdx !== camera && pLayerIdx !== circleMaster && pLayerIdx !== circleCamera && pLayerIdx !== arcMaster && pLayerIdx !== arcCamera && pLayerIdx !== helixMaster && pLayerIdx !== helixCamera) {
                            card.parent = pLayerIdx;
                            restoredParent = true;
                        }
                    } catch (e2) {}
                }
                if (!restoredParent) card.parent = null;

                if (metaObj) {
                    if (metaObj.origPos) setLayerPosition(card, metaObj.origPos[0], metaObj.origPos[1], metaObj.origPos[2]);
                    if (metaObj.origScale) setLayerScale(card, metaObj.origScale);
                    var tg = card.property("ADBE Transform Group") || card.property("Transform");
                    if (tg) {
                        if (metaObj.origOrient && tg.property("ADBE Orientation")) safeSetValue(tg.property("ADBE Orientation"), metaObj.origOrient);
                        if (metaObj.origRotX !== undefined && tg.property("ADBE X Rotation")) safeSetValue(tg.property("ADBE X Rotation"), metaObj.origRotX);
                        if (metaObj.origRotY !== undefined && tg.property("ADBE Y Rotation")) safeSetValue(tg.property("ADBE Y Rotation"), metaObj.origRotY);
                        if (metaObj.origRotZ !== undefined && tg.property("ADBE Z Rotation")) safeSetValue(tg.property("ADBE Z Rotation"), metaObj.origRotZ);
                    }
                    if (metaObj.orig3D !== undefined) { try { card.threeDLayer = metaObj.orig3D; } catch (e3D) {} }
                }
            }

            if (master) try { master.remove(); } catch (eRem1) {}
            if (camera) try { camera.remove(); } catch (eRem2) {}

            app.endUndoGroup();
            return true;

        } catch (err) {
            app.endUndoGroup();
            reportError("Operation failed during Delete Easy 3D:\n" + err.toString());
            return false;
        }
    }

    // ------------------------------------------------------------------------
    // 3D SPHERE DISTRIBUTOR CAROUSEL ENGINE (V1.0 - UNIFORM FIBONACCI SPHERE DISTRIBUTION)
    // ------------------------------------------------------------------------
    function findSphereMaster(comp) {
        if (!comp) return null;
        for (var i = 1; i <= comp.numLayers; i++) {
            var l = comp.layer(i);
            if (!l) continue;
            var comment = l.comment || "";
            if (l.name === SPHERE_MASTER_NAME || comment.indexOf(TAG_SPHERE_MASTER) !== -1) {
                return l;
            }
        }
        return null;
    }

    function findSphereCamera(comp) {
        if (!comp) return null;
        for (var i = 1; i <= comp.numLayers; i++) {
            var l = comp.layer(i);
            if (!l) continue;
            var comment = l.comment || "";
            if (l.name === SPHERE_CAMERA_NAME || comment.indexOf(TAG_SPHERE_CAMERA) !== -1) {
                return l;
            }
        }
        return null;
    }

    function setupSphereMasterNull(comp, radius, startAngle, scaleVal, backScale, scaleExp, maxBlur, faceCamera, rotX, rotY, rotZ, autoRotate, rotSpeed) {
        if (!comp) return null;
        var master = findSphereMaster(comp);
        if (!master) {
            master = comp.layers.addNull();
            if (!master) return null;
            master.name = SPHERE_MASTER_NAME;
            master.comment = TAG_SPHERE_MASTER;
            master.guideLayer = true;
            master.label = 11;
        }

        try { master.threeDLayer = true; } catch (e) {}
        setLayerPosition(master, comp.width / 2, comp.height / 2, 0);

        setEffectValue(getOrAddEffect(master, "ADBE Slider Control", "C3D Radius"), safeNumber(radius, DEFAULT_RADIUS, MIN_RADIUS));
        setEffectValue(getOrAddEffect(master, "ADBE Slider Control", "C3D Start Angle"), safeNumber(startAngle, DEFAULT_START_ANGLE));
        setEffectValue(getOrAddEffect(master, "ADBE Slider Control", "C3D Scale"), safeNumber(scaleVal, DEFAULT_SCALE, MIN_SCALE));
        setEffectValue(getOrAddEffect(master, "ADBE Slider Control", "C3D Back Scale"), safeNumber(backScale, DEFAULT_SPHERE_BACK_SCALE, 0, 100));
        setEffectValue(getOrAddEffect(master, "ADBE Slider Control", "C3D Scale Exponent"), safeNumber(scaleExp, DEFAULT_SPHERE_SCALE_EXP, 0.1, 5.0));
        setEffectValue(getOrAddEffect(master, "ADBE Slider Control", "C3D Max Blur"), safeNumber(maxBlur, DEFAULT_SPHERE_MAX_BLUR, 0, 100));
        setEffectValue(getOrAddEffect(master, "ADBE Checkbox Control", "C3D Face Camera"), faceCamera ? 1 : 0);
        setEffectValue(getOrAddEffect(master, "ADBE Slider Control", "C3D X Rotation"), safeNumber(rotX, DEFAULT_ROT_X));
        setEffectValue(getOrAddEffect(master, "ADBE Slider Control", "C3D Y Rotation"), safeNumber(rotY, DEFAULT_ROT_Y));
        setEffectValue(getOrAddEffect(master, "ADBE Slider Control", "C3D Z Rotation"), safeNumber(rotZ, DEFAULT_ROT_Z));
        setEffectValue(getOrAddEffect(master, "ADBE Checkbox Control", "C3D Auto Rotate"), autoRotate ? 1 : 0);
        setEffectValue(getOrAddEffect(master, "ADBE Slider Control", "C3D Rotation Speed"), safeNumber(rotSpeed, DEFAULT_ROT_SPEED));

        updateAutoRotateExpression(master);
        return master;
    }

    function setupSphereCamera(comp, masterNull, radius) {
        return null;
    }

    function getSphereCarouselCards(comp, masterNull) {
        var cards = [];
        if (!comp || !masterNull) return cards;

        for (var i = 1; i <= comp.numLayers; i++) {
            var l = comp.layer(i);
            if (!l) continue;
            var comment = l.comment || "";
            // STRICT FILTERING: Must be parented to Sphere Master AND contain Sphere metadata prefix
            if (l.parent === masterNull && comment.indexOf(META_SPHERE_PREFIX) !== -1) {
                cards.push(l);
            }
        }
        return cards;
    }

    function applySphereLayout(comp, masterNull, cards, settings) {
        if (!comp || !masterNull || !cards || cards.length === 0) return false;

        var radius = safeNumber(settings.radius, DEFAULT_RADIUS, MIN_RADIUS);
        var startAngle = safeNumber(settings.startAngle, DEFAULT_START_ANGLE);
        var scaleVal = safeNumber(settings.scale, DEFAULT_SCALE, MIN_SCALE);
        var faceCamera = settings.faceCamera !== false;

        var totalCount = cards.length;

        for (var k = 0; k < totalCount; k++) {
            var card = cards[k];
            if (!card) continue;

            try { card.threeDLayer = true; } catch (e) {}
            card.parent = masterNull;

            var origScale = [100, 100, 100];
            var comment = card.comment || "";
            var metaObj = extractMetadataFromComment(comment, META_SPHERE_PREFIX);
            if (metaObj && metaObj.origScale) {
                origScale = metaObj.origScale;
            }

            var origX = (origScale && origScale[0] !== undefined) ? origScale[0] : 100;
            var origY = (origScale && origScale[1] !== undefined) ? origScale[1] : 100;
            var origZ = (origScale && origScale[2] !== undefined) ? origScale[2] : 100;

            // Position Expression
            var posExpr = EXPR_OWNERSHIP_MARKER + "\n" +
                          "var ctrl = parent;\n" +
                          "var r = ctrl.effect('C3D Radius')(1).value;\n" +
                          "var startA = ctrl.effect('C3D Start Angle')(1).value;\n" +
                          "var totalCount = " + totalCount + ";\n" +
                          "var k = " + k + ";\n" +
                          "var goldenAngle = 2.399963229728653;\n" +
                          "var yNorm = (totalCount > 1) ? (1 - (2 * k) / (totalCount - 1)) : 0;\n" +
                          "var rRing = Math.sqrt(Math.max(0, 1 - yNorm * yNorm));\n" +
                          "var theta = k * goldenAngle + degreesToRadians(startA);\n" +
                          "var x = r * rRing * Math.cos(theta);\n" +
                          "var y = r * yNorm;\n" +
                          "var z = r * rRing * Math.sin(theta);\n" +
                          "[x, y, z];";
            setCardPositionExpression(card, posExpr);

            // Depth Scale Expression (Front big, Back small)
            var scaleExpr = EXPR_OWNERSHIP_MARKER + "\n" +
                            "var ctrl = parent;\n" +
                            "var gS = ctrl.effect('C3D Scale')(1).value / 100;\n" +
                            "var bS = ctrl.effect('C3D Back Scale')('Slider').value / 100;\n" +
                            "var sExp = ctrl.effect('C3D Scale Exponent')('Slider').value;\n" +
                            "var r = ctrl.effect('C3D Radius')(1).value;\n" +
                            "var wP = toWorld(anchorPoint)[2];\n" +
                            "var cP = ctrl.toWorld(ctrl.anchorPoint)[2];\n" +
                            "var depth = wP - cP;\n" +
                            "if (r == 0) { var norm = 0; } else { var norm = Math.max(0, Math.min(1, (depth + r) / (2 * r))); }\n" +
                            "var factor = gS * Math.pow((1 - norm) + norm * bS, sExp);\n" +
                            "[" + origX + " * factor, " + origY + " * factor, " + origZ + " * factor];";
            setCardScaleExpression(card, scaleExpr);

            // Background Depth Blur Effect & Expression (Front 0px sharp, Back blurred)
            var blurFx = getOrAddBlurEffect(card, "C3D Depth Blur");
            if (blurFx && typeof blurFx.property === "function") {
                var blurProp = blurFx.property("Blurriness") || blurFx.property("Blur Radius") || blurFx.property(1);
                if (blurProp) {
                    var blurExpr = EXPR_OWNERSHIP_MARKER + "\n" +
                                   "var ctrl = parent;\n" +
                                   "var maxBlur = ctrl.effect('C3D Max Blur')('Slider').value;\n" +
                                   "var r = ctrl.effect('C3D Radius')(1).value;\n" +
                                   "var wP = toWorld(anchorPoint)[2];\n" +
                                   "var cP = ctrl.toWorld(ctrl.anchorPoint)[2];\n" +
                                   "var depth = wP - cP;\n" +
                                   "if (r == 0) { var norm = 0; } else { var norm = Math.max(0, Math.min(1, (depth + r) / (2 * r))); }\n" +
                                   "norm * maxBlur;";
                    safeSetExpression(blurProp, blurExpr);
                }
            }

            var tgCard = card.property("ADBE Transform Group") || card.property("Transform");
            if (tgCard) {
                var oProp = tgCard.property("ADBE Orientation") || tgCard.property("Orientation");
                if (oProp) safeSetValue(oProp, [0, 0, 0]);

                var rxProp = tgCard.property("ADBE X Rotation") || tgCard.property("X Rotation");
                var ryProp = tgCard.property("ADBE Y Rotation") || tgCard.property("Y Rotation");
                var rzProp = tgCard.property("ADBE Z Rotation") || tgCard.property("Z Rotation");

                if (faceCamera) {
                    if (oProp) {
                        var orientExprSphere = EXPR_OWNERSHIP_MARKER + "\n" +
                                               "var uX = [1, 0, 0];\n" +
                                               "var uY = [0, 1, 0];\n" +
                                               "var uZ = [0, 0, 1];\n" +
                                               "var vX = parent.fromWorldVec(uX);\n" +
                                               "var vY = parent.fromWorldVec(uY);\n" +
                                               "var vZ = parent.fromWorldVec(uZ);\n" +
                                               "var sinY = -Math.max(-1, Math.min(1, vX[2]));\n" +
                                               "var yDeg = radiansToDegrees(Math.asin(sinY));\n" +
                                               "var zDeg = radiansToDegrees(Math.atan2(vX[1], vX[0]));\n" +
                                               "var xDeg = radiansToDegrees(Math.atan2(vY[2], vZ[2]));\n" +
                                               "[xDeg, yDeg, zDeg];";
                        safeSetExpression(oProp, orientExprSphere);
                    }
                    if (rxProp) { safeSetExpression(rxProp, ""); safeSetValue(rxProp, 0); }
                    if (ryProp) { safeSetExpression(ryProp, ""); safeSetValue(ryProp, 0); }
                    if (rzProp) { safeSetExpression(rzProp, ""); safeSetValue(rzProp, 0); }
                } else {
                    if (oProp) { safeSetExpression(oProp, ""); safeSetValue(oProp, [0, 0, 0]); }
                    if (rzProp) safeSetExpression(rzProp, "");

                    var rotYExpr = EXPR_OWNERSHIP_MARKER + "\n" +
                                   "var p = transform.position;\n" +
                                   "var facingYRad = Math.atan2(p[0], p[2]);\n" +
                                   "radiansToDegrees(facingYRad) + 180;";
                    if (ryProp) safeSetExpression(ryProp, rotYExpr);

                    var rotXExpr = EXPR_OWNERSHIP_MARKER + "\n" +
                                   "var p = transform.position;\n" +
                                   "var r = parent.effect('C3D Radius')(1).value;\n" +
                                   "if (r == 0) r = 0.001;\n" +
                                   "var facingXRad = Math.asin(Math.max(-1, Math.min(1, -p[1] / r)));\n" +
                                   "radiansToDegrees(facingXRad);";
                    if (rxProp) safeSetExpression(rxProp, rotXExpr);
                }
            }
        }

        updateAutoRotateExpression(masterNull);
        return true;
    }

    function createSphereCarousel(params) {
        var comp = getActiveComp();
        if (!comp) {
            reportError("No active composition found. Please open a composition in After Effects.");
            return false;
        }

        var selected = comp.selectedLayers;
        if (!selected || selected.length === 0) {
            reportError("Please select at least 2 artwork layers in the active composition.");
            return false;
        }

        var validLayers = [];
        for (var i = 0; i < selected.length; i++) {
            var l = selected[i];
            if (!l) continue;
            if (l.name !== CIRCLE_MASTER_NAME && l.name !== CIRCLE_CAMERA_NAME &&
                l.name !== ARC_MASTER_NAME && l.name !== ARC_CAMERA_NAME &&
                l.name !== HELIX_MASTER_NAME && l.name !== HELIX_CAMERA_NAME &&
                l.name !== EASY_MASTER_NAME && l.name !== EASY_CAMERA_NAME &&
                l.name !== SPHERE_MASTER_NAME && l.name !== SPHERE_CAMERA_NAME) {
                validLayers.push(l);
            }
        }

        if (validLayers.length < 2) {
            reportError("Please select at least 2 artwork layers in the active composition.");
            return false;
        }

        if (findSphereMaster(comp)) {
            reportError("3D Sphere Distributor already exists in this composition. Use UPDATE or DELETE.");
            return false;
        }

        app.beginUndoGroup("Create 3D Sphere Distributor – Motion by DK");

        try {
            var radius = safeNumber(params.radius, DEFAULT_RADIUS, MIN_RADIUS);
            var startAngle = safeNumber(params.startAngle, DEFAULT_START_ANGLE);
            var scaleVal = safeNumber(params.scale, DEFAULT_SCALE, MIN_SCALE);
            var backScale = safeNumber(params.backScale, DEFAULT_SPHERE_BACK_SCALE, 0, 100);
            var scaleExp = safeNumber(params.scaleExp, DEFAULT_SPHERE_SCALE_EXP, 0.1, 5.0);
            var maxBlur = safeNumber(params.maxBlur, DEFAULT_SPHERE_MAX_BLUR, 0, 100);
            var faceCamera = params.faceCamera !== false;
            var rotX = safeNumber(params.rotX, DEFAULT_ROT_X);
            var rotY = safeNumber(params.rotY, DEFAULT_ROT_Y);
            var rotZ = safeNumber(params.rotZ, DEFAULT_ROT_Z);
            var autoRotate = params.autoRotate === true;
            var rotSpeed = safeNumber(params.rotSpeed, DEFAULT_ROT_SPEED);

            var master = setupSphereMasterNull(comp, radius, startAngle, scaleVal, backScale, scaleExp, maxBlur, faceCamera, rotX, rotY, rotZ, autoRotate, rotSpeed);
            if (!master) {
                reportError("Operation failed during Create Sphere: Unable to create Master Null controller.");
                app.endUndoGroup();
                return false;
            }

            var totalCount = validLayers.length;
            for (var j = 0; j < totalCount; j++) {
                var card = validLayers[j];
                var is3D = card.threeDLayer;
                var origPos = getLayerPosition(card);
                var tg = card.property("ADBE Transform Group") || card.property("Transform");
                var origScale = [100, 100, 100];
                var origOrient = [0, 0, 0];
                var origRotX = 0, origRotY = 0, origRotZ = 0;

                if (tg) {
                    var sProp = tg.property("ADBE Scale") || tg.property("Scale");
                    if (sProp && sProp.value) origScale = sProp.value;
                    var oProp = tg.property("ADBE Orientation") || tg.property("Orientation");
                    if (oProp && oProp.value) origOrient = oProp.value;
                    var rxProp = tg.property("ADBE X Rotation") || tg.property("X Rotation");
                    if (rxProp && rxProp.value !== undefined) origRotX = rxProp.value;
                    var ryProp = tg.property("ADBE Y Rotation") || tg.property("Y Rotation");
                    if (ryProp && ryProp.value !== undefined) origRotY = ryProp.value;
                    var rzProp = tg.property("ADBE Z Rotation") || tg.property("Z Rotation");
                    if (rzProp && rzProp.value !== undefined) origRotZ = rzProp.value;
                }

                var metaObj = {
                    C3D_TYPE: "SPHERE_CARD",
                    orig3D: is3D,
                    origParentName: (card.parent && card.parent.name) ? card.parent.name : null,
                    origParentIndex: (card.parent && card.parent.index) ? card.parent.index : null,
                    origPos: [origPos[0], origPos[1], origPos[2]],
                    origScale: [origScale[0], origScale[1], origScale[2]],
                    origOrient: [origOrient[0], origOrient[1], origOrient[2]],
                    origRotX: origRotX, origRotY: origRotY, origRotZ: origRotZ
                };
                
                var existingComment = card.comment || "";
                var cleanComment = removeMetadataFromComment(existingComment, META_SPHERE_PREFIX);
                card.comment = cleanComment + META_SPHERE_PREFIX + serializeMetadata(metaObj) + META_SUFFIX;
                card.parent = master;
            }

            var settings = { radius: radius, startAngle: startAngle, scale: scaleVal, faceCamera: faceCamera };
            applySphereLayout(comp, master, validLayers, settings);

            app.endUndoGroup();
            return true;

        } catch (err) {
            app.endUndoGroup();
            reportError("Operation failed during Create Sphere:\n" + err.toString());
            return false;
        }
    }

    function updateSphereCarousel(params, skipUndo) {
        var comp = getActiveComp();
        if (!comp) return reportError("No active composition found.", (typeof params !== "undefined" && params) ? (params.silent || params.isLivePreview) : false);

        var master = findSphereMaster(comp);
        if (!master) return reportError("C3D_SPHERE_MASTER not found in active composition. Use CREATE SPHERE first.", (typeof params !== "undefined" && params) ? (params.silent || params.isLivePreview) : false);

        if (!skipUndo) app.beginUndoGroup("Update 3D Sphere Distributor – Motion by DK");

        try {
            var eRadius = getOrAddEffect(master, "ADBE Slider Control", "C3D Radius");
            var eAngle = getOrAddEffect(master, "ADBE Slider Control", "C3D Start Angle");
            var eScale = getOrAddEffect(master, "ADBE Slider Control", "C3D Scale");
            var eBackScale = getOrAddEffect(master, "ADBE Slider Control", "C3D Back Scale");
            var eScaleExp = getOrAddEffect(master, "ADBE Slider Control", "C3D Scale Exponent");
            var eMaxBlur = getOrAddEffect(master, "ADBE Slider Control", "C3D Max Blur");
            var eFaceCam = getOrAddEffect(master, "ADBE Checkbox Control", "C3D Face Camera");
            var eRotX = getOrAddEffect(master, "ADBE Slider Control", "C3D X Rotation");
            var eRotY = getOrAddEffect(master, "ADBE Slider Control", "C3D Y Rotation");
            var eRotZ = getOrAddEffect(master, "ADBE Slider Control", "C3D Z Rotation");
            var eAutoRot = getOrAddEffect(master, "ADBE Checkbox Control", "C3D Auto Rotate");
            var eSpeed = getOrAddEffect(master, "ADBE Slider Control", "C3D Rotation Speed");

            if (params.radius !== undefined) setEffectValue(eRadius, safeNumber(params.radius, DEFAULT_RADIUS, MIN_RADIUS));
            if (params.startAngle !== undefined) setEffectValue(eAngle, safeNumber(params.startAngle, DEFAULT_START_ANGLE));
            if (params.scale !== undefined) setEffectValue(eScale, safeNumber(params.scale, DEFAULT_SCALE, MIN_SCALE));
            if (params.backScale !== undefined) setEffectValue(eBackScale, safeNumber(params.backScale, DEFAULT_SPHERE_BACK_SCALE, 0, 100));
            if (params.scaleExp !== undefined) setEffectValue(eScaleExp, safeNumber(params.scaleExp, DEFAULT_SPHERE_SCALE_EXP, 0.1, 5.0));
            if (params.maxBlur !== undefined) setEffectValue(eMaxBlur, safeNumber(params.maxBlur, DEFAULT_SPHERE_MAX_BLUR, 0, 100));
            if (params.faceCamera !== undefined) setEffectValue(eFaceCam, params.faceCamera ? 1 : 0);
            if (params.rotX !== undefined) setEffectValue(eRotX, safeNumber(params.rotX, DEFAULT_ROT_X));
            if (params.rotY !== undefined) setEffectValue(eRotY, safeNumber(params.rotY, DEFAULT_ROT_Y));
            if (params.rotZ !== undefined) setEffectValue(eRotZ, safeNumber(params.rotZ, DEFAULT_ROT_Z));
            if (params.autoRotate !== undefined) setEffectValue(eAutoRot, params.autoRotate ? 1 : 0);
            if (params.rotSpeed !== undefined) setEffectValue(eSpeed, safeNumber(params.rotSpeed, DEFAULT_ROT_SPEED));

            var radius = getEffectValue(eRadius, safeNumber(params.radius, DEFAULT_RADIUS, MIN_RADIUS));
            var startAngle = getEffectValue(eAngle, safeNumber(params.startAngle, DEFAULT_START_ANGLE));
            var scaleVal = getEffectValue(eScale, safeNumber(params.scale, DEFAULT_SCALE, MIN_SCALE));
            var faceCamera = (getEffectValue(eFaceCam, 1) === 1);

            var cards = getSphereCarouselCards(comp, master);
            var settings = { radius: radius, startAngle: startAngle, scale: scaleVal, faceCamera: faceCamera };
            applySphereLayout(comp, master, cards, settings);

            if (!skipUndo) app.endUndoGroup();
            return true;

        } catch (err) {
            if (!skipUndo) app.endUndoGroup();
            reportError("Operation failed during Update Sphere:\n" + err.toString(), (typeof params !== "undefined" && params) ? (params.silent || params.isLivePreview) : false);
            return false;
        }
    }

    function resetSphereCarousel() {
        var comp = getActiveComp();
        if (!comp) return false;

        app.beginUndoGroup("Reset 3D Sphere Distributor – Motion by DK");
        try {
            var defaults = {
                radius: DEFAULT_RADIUS,
                startAngle: DEFAULT_START_ANGLE,
                scale: DEFAULT_SCALE,
                backScale: DEFAULT_SPHERE_BACK_SCALE,
                scaleExp: DEFAULT_SPHERE_SCALE_EXP,
                maxBlur: DEFAULT_SPHERE_MAX_BLUR,
                faceCamera: true,
                autoRotate: DEFAULT_AUTO_ROTATE,
                rotSpeed: DEFAULT_ROT_SPEED
            };

            var master = findSphereMaster(comp);
            if (master) {
                updateSphereCarousel(defaults, true);
            }
            app.endUndoGroup();
            return true;
        } catch (e) {
            app.endUndoGroup();
            return false;
        }
    }

    function deleteSphereCarousel() {
        var comp = getActiveComp();
        if (!comp) return reportError("No active composition found.", (typeof params !== "undefined" && params) ? (params.silent || params.isLivePreview) : false);

        var master = findSphereMaster(comp);
        var camera = findSphereCamera(comp);
        if (!master && !camera) return reportError("No 3D Sphere Distributor controllers found in active composition.");

        app.beginUndoGroup("Delete 3D Sphere Distributor – Motion by DK");

        try {
            var cards = getSphereCarouselCards(comp, master);
            var circleMaster = findCircleMaster(comp);
            var circleCamera = findCircleCamera(comp);
            var arcMaster = findArcMaster(comp);
            var arcCamera = findArcCamera(comp);
            var helixMaster = findHelixMaster(comp);
            var helixCamera = findHelixCamera(comp);
            var easyMaster = findEasyMaster(comp);
            var easyCamera = findEasyCamera(comp);

            for (var i = 0; i < cards.length; i++) {
                var card = cards[i];
                if (!card) continue;

                removeAllLayerExpressions(card);

                try {
                    var fxGroup = getEffectsGroup(card);
                    if (fxGroup) {
                        var blurFx = fxGroup.property("C3D Depth Blur");
                        if (blurFx) blurFx.remove();
                    }
                } catch (eBlur) {}

                var metaObj = extractMetadataFromComment(card.comment, META_SPHERE_PREFIX);
                if (metaObj) {
                    card.comment = removeMetadataFromComment(card.comment, META_SPHERE_PREFIX);
                }

                var restoredParent = false;
                if (metaObj && metaObj.origParentName) {
                    try {
                        var pLayer = comp.layer(metaObj.origParentName);
                        // PREVENT RE-PARENTING TO CAROUSEL MASTERS OR CAMERAS
                        if (pLayer && pLayer !== master && pLayer !== camera && pLayer !== circleMaster && pLayer !== circleCamera && pLayer !== arcMaster && pLayer !== arcCamera && pLayer !== helixMaster && pLayer !== helixCamera && pLayer !== easyMaster && pLayer !== easyCamera) {
                            card.parent = pLayer;
                            restoredParent = true;
                        }
                    } catch (e1) {}
                }
                if (!restoredParent && metaObj && metaObj.origParentIndex) {
                    try {
                        var pLayerIdx = comp.layer(metaObj.origParentIndex);
                        if (pLayerIdx && pLayerIdx !== master && pLayerIdx !== camera && pLayerIdx !== circleMaster && pLayerIdx !== circleCamera && pLayerIdx !== arcMaster && pLayerIdx !== arcCamera && pLayerIdx !== helixMaster && pLayerIdx !== helixCamera && pLayerIdx !== easyMaster && pLayerIdx !== easyCamera) {
                            card.parent = pLayerIdx;
                            restoredParent = true;
                        }
                    } catch (e2) {}
                }
                if (!restoredParent) card.parent = null;

                if (metaObj) {
                    if (metaObj.origPos) setLayerPosition(card, metaObj.origPos[0], metaObj.origPos[1], metaObj.origPos[2]);
                    if (metaObj.origScale) setLayerScale(card, metaObj.origScale);
                    var tg = card.property("ADBE Transform Group") || card.property("Transform");
                    if (tg) {
                        if (metaObj.origOrient && tg.property("ADBE Orientation")) safeSetValue(tg.property("ADBE Orientation"), metaObj.origOrient);
                        if (metaObj.origRotX !== undefined && tg.property("ADBE X Rotation")) safeSetValue(tg.property("ADBE X Rotation"), metaObj.origRotX);
                        if (metaObj.origRotY !== undefined && tg.property("ADBE Y Rotation")) safeSetValue(tg.property("ADBE Y Rotation"), metaObj.origRotY);
                        if (metaObj.origRotZ !== undefined && tg.property("ADBE Z Rotation")) safeSetValue(tg.property("ADBE Z Rotation"), metaObj.origRotZ);
                    }
                    if (metaObj.orig3D !== undefined) { try { card.threeDLayer = metaObj.orig3D; } catch (e3D) {} }
                }
            }

            if (master) try { master.remove(); } catch (eRem1) {}
            if (camera) try { camera.remove(); } catch (eRem2) {}

            app.endUndoGroup();
            return true;

        } catch (err) {
            app.endUndoGroup();
            reportError("Operation failed during Delete Sphere:\n" + err.toString());
            return false;
        }
    }

    function isCarouselMasterOrCamera(layer) {
        if (!layer) return true;
        var name = layer.name || "";
        if (name === CIRCLE_MASTER_NAME || name === CIRCLE_CAMERA_NAME ||
            name === ARC_MASTER_NAME || name === ARC_CAMERA_NAME ||
            name === HELIX_MASTER_NAME || name === HELIX_CAMERA_NAME ||
            name === EASY_MASTER_NAME || name === EASY_CAMERA_NAME ||
            name === SPHERE_MASTER_NAME || name === SPHERE_CAMERA_NAME ||
            name === RING_MASTER_NAME || name === RING_CAMERA_NAME ||
            name === COVER_MASTER_NAME || name === COVER_CAMERA_NAME) {
            return true;
        }
        return false;
    }

    // ------------------------------------------------------------------------
    // RING CAROUSEL ENGINE (V1.0 - FLAT UPRIGHT RING CAROUSEL)
    // ------------------------------------------------------------------------
    function findRingMaster(comp) {
        if (!comp) return null;
        for (var i = 1; i <= comp.numLayers; i++) {
            var l = comp.layer(i);
            if (!l) continue;
            var comment = l.comment || "";
            if (l.name === RING_MASTER_NAME || comment.indexOf(TAG_RING_MASTER) !== -1) {
                return l;
            }
        }
        return null;
    }

    function findRingCamera(comp) {
        if (!comp) return null;
        for (var i = 1; i <= comp.numLayers; i++) {
            var l = comp.layer(i);
            if (!l) continue;
            var comment = l.comment || "";
            if (l.name === RING_CAMERA_NAME || comment.indexOf(TAG_RING_CAMERA) !== -1) {
                return l;
            }
        }
        return null;
    }

    function updateRingMasterRotationExpressions(masterNull) {
        if (!masterNull) return;
        var tg = masterNull.property("ADBE Transform Group") || masterNull.property("Transform");
        if (!tg) return;

        var rxProp = tg.property("ADBE X Rotation") || tg.property("X Rotation");
        if (rxProp) {
            safeSetExpression(rxProp, EXPR_OWNERSHIP_MARKER + "\n" + "effect('C3D X Rotation')(1).value;");
        }

        var ryProp = tg.property("ADBE Y Rotation") || tg.property("Y Rotation");
        if (ryProp) {
            safeSetExpression(ryProp, EXPR_OWNERSHIP_MARKER + "\n" + "effect('C3D Y Rotation')(1).value;");
        }

        var rzProp = tg.property("ADBE Z Rotation") || tg.property("Z Rotation");
        if (rzProp) {
            safeSetExpression(rzProp, EXPR_OWNERSHIP_MARKER + "\n" + "effect('C3D Z Rotation')(1).value;");
        }
    }

    function setupRingMasterNull(comp, radiusX, radiusY, startAngle, spacing, scaleVal, rotX, rotY, rotZ) {
        if (!comp) return null;
        var master = findRingMaster(comp);
        if (!master) {
            master = comp.layers.addNull();
            if (!master) return null;
            master.name = RING_MASTER_NAME;
            master.comment = TAG_RING_MASTER;
            master.guideLayer = true;
            master.label = 10;
        }

        try { master.threeDLayer = true; } catch (e) {}
        setLayerPosition(master, comp.width / 2, comp.height / 2, 0);

        setEffectValue(getOrAddEffect(master, "ADBE Slider Control", "C3D Radius X"), safeNumber(radiusX, DEFAULT_RADIUS, MIN_RADIUS));
        setEffectValue(getOrAddEffect(master, "ADBE Slider Control", "C3D Radius Y"), safeNumber(radiusY, DEFAULT_RADIUS, MIN_RADIUS));
        setEffectValue(getOrAddEffect(master, "ADBE Slider Control", "C3D Start Angle"), safeNumber(startAngle, DEFAULT_START_ANGLE));
        setEffectValue(getOrAddEffect(master, "ADBE Slider Control", "C3D Ring Spacing"), safeNumber(spacing, DEFAULT_RING_SPACING));
        setEffectValue(getOrAddEffect(master, "ADBE Slider Control", "C3D Scale"), safeNumber(scaleVal, DEFAULT_SCALE, MIN_SCALE));
        setEffectValue(getOrAddEffect(master, "ADBE Slider Control", "C3D X Rotation"), safeNumber(rotX, DEFAULT_ROT_X));
        setEffectValue(getOrAddEffect(master, "ADBE Slider Control", "C3D Y Rotation"), safeNumber(rotY, DEFAULT_ROT_Y));
        setEffectValue(getOrAddEffect(master, "ADBE Slider Control", "C3D Z Rotation"), safeNumber(rotZ, DEFAULT_ROT_Z));

        try {
            var fxG = getEffectsGroup(master);
            if (fxG) {
                var eAR = fxG.property("C3D Auto Rotate");
                if (eAR) eAR.remove();
                var eRS = fxG.property("C3D Rotation Speed");
                if (eRS) eRS.remove();
            }
        } catch (eRem) {}

        updateRingMasterRotationExpressions(master);
        return master;
    }

    function setupRingCamera(comp, masterNull, radius) {
        return null;
    }

    function getRingCarouselCards(comp, masterNull) {
        var cards = [];
        if (!comp || !masterNull) return cards;

        for (var i = 1; i <= comp.numLayers; i++) {
            var l = comp.layer(i);
            if (!l) continue;
            var comment = l.comment || "";
            // STRICT FILTERING: Must be parented to Ring Master AND contain Ring metadata prefix
            if (l.parent === masterNull && comment.indexOf(META_RING_PREFIX) !== -1) {
                cards.push(l);
            }
        }
        return cards;
    }

    function applyRingLayout(comp, masterNull, cards, settings) {
        if (!comp || !masterNull || !cards || cards.length === 0) return false;

        var radiusX = safeNumber(settings.radiusX, DEFAULT_RADIUS, MIN_RADIUS);
        var radiusY = safeNumber(settings.radiusY, DEFAULT_RADIUS, MIN_RADIUS);
        var startAngle = safeNumber(settings.startAngle, DEFAULT_START_ANGLE);
        var spacing = safeNumber(settings.spacing, DEFAULT_RING_SPACING);
        var scaleVal = safeNumber(settings.scale, DEFAULT_SCALE, MIN_SCALE);

        var totalCount = cards.length;

        for (var k = 0; k < totalCount; k++) {
            var card = cards[k];
            if (!card) continue;

            try { card.threeDLayer = true; } catch (e) {}
            card.parent = masterNull;

            var origScale = [100, 100, 100];
            var comment = card.comment || "";
            var metaObj = extractMetadataFromComment(comment, META_RING_PREFIX);
            if (metaObj && metaObj.origScale) {
                origScale = metaObj.origScale;
            }

            var origX = (origScale && origScale[0] !== undefined) ? origScale[0] : 100;
            var origY = (origScale && origScale[1] !== undefined) ? origScale[1] : 100;
            var origZ = (origScale && origScale[2] !== undefined) ? origScale[2] : 100;

            // Position Expression (Elliptical / Circular Ring Spacing)
            var posExpr = EXPR_OWNERSHIP_MARKER + "\n" +
                          "var ctrl = parent;\n" +
                          "var rx = ctrl.effect('C3D Radius X')('Slider').value;\n" +
                          "var ry = ctrl.effect('C3D Radius Y')('Slider').value;\n" +
                          "var startA = ctrl.effect('C3D Start Angle')(1).value;\n" +
                          "var spacing = ctrl.effect('C3D Ring Spacing')('Slider').value;\n" +
                          "var num = " + totalCount + ";\n" +
                          "var idx = " + k + ";\n" +
                          "var stepA = (num > 0) ? (spacing / num) : 0;\n" +
                          "var angleDeg = startA + (idx * stepA);\n" +
                          "var angleRad = degreesToRadians(angleDeg);\n" +
                          "var x = Math.cos(angleRad) * rx;\n" +
                          "var y = Math.sin(angleRad) * ry;\n" +
                          "[x, y, 0];";
            setCardPositionExpression(card, posExpr);

            // Scale Expression
            var scaleExpr = EXPR_OWNERSHIP_MARKER + "\n" +
                            "var ctrl = parent;\n" +
                            "var factor = ctrl.effect('C3D Scale')(1).value / 100;\n" +
                            "[" + origX + " * factor, " + origY + " * factor, " + origZ + " * factor];";
            setCardScaleExpression(card, scaleExpr);

            // Upright Counter-Rotation Expressions (Flat facing camera in 3D world space)
            var tgCard = card.property("ADBE Transform Group") || card.property("Transform");
            if (tgCard) {
                var oProp = tgCard.property("ADBE Orientation") || tgCard.property("Orientation");
                if (oProp) {
                    var orientExpr = EXPR_OWNERSHIP_MARKER + "\n" +
                                     "var uX = [1, 0, 0];\n" +
                                     "var uY = [0, 1, 0];\n" +
                                     "var uZ = [0, 0, 1];\n" +
                                     "var vX = parent.fromWorldVec(uX);\n" +
                                     "var vY = parent.fromWorldVec(uY);\n" +
                                     "var vZ = parent.fromWorldVec(uZ);\n" +
                                     "var sinY = -Math.max(-1, Math.min(1, vX[2]));\n" +
                                     "var yDeg = radiansToDegrees(Math.asin(sinY));\n" +
                                     "var zDeg = radiansToDegrees(Math.atan2(vX[1], vX[0]));\n" +
                                     "var xDeg = radiansToDegrees(Math.atan2(vY[2], vZ[2]));\n" +
                                     "[xDeg, yDeg, zDeg];";
                    safeSetExpression(oProp, orientExpr);
                }

                var rxProp = tgCard.property("ADBE X Rotation") || tgCard.property("X Rotation");
                if (rxProp) {
                    safeSetExpression(rxProp, "");
                    safeSetValue(rxProp, 0);
                }

                var ryProp = tgCard.property("ADBE Y Rotation") || tgCard.property("Y Rotation");
                if (ryProp) {
                    safeSetExpression(ryProp, "");
                    safeSetValue(ryProp, 0);
                }

                var rzProp = tgCard.property("ADBE Z Rotation") || tgCard.property("Z Rotation");
                if (rzProp) {
                    safeSetExpression(rzProp, "");
                    safeSetValue(rzProp, 0);
                }
            }
        }

        updateRingMasterRotationExpressions(masterNull);
        return true;
    }

    function createRingCarousel(params) {
        var comp = getActiveComp();
        if (!comp) {
            reportError("No active composition found. Please open a composition in After Effects.");
            return false;
        }

        var selected = comp.selectedLayers;
        if (!selected || selected.length === 0) {
            reportError("Please select at least 2 artwork layers in the active composition.");
            return false;
        }

        var validLayers = [];
        for (var i = 0; i < selected.length; i++) {
            var l = selected[i];
            if (!l) continue;
            if (!isCarouselMasterOrCamera(l)) {
                validLayers.push(l);
            }
        }

        if (validLayers.length < 2) {
            reportError("Please select at least 2 artwork layers in the active composition.");
            return false;
        }

        if (findRingMaster(comp)) {
            reportError("Ring Carousel already exists in this composition. Use UPDATE or DELETE.");
            return false;
        }

        app.beginUndoGroup("Create Ring Carousel – Motion by DK");

        try {
            var radiusX = safeNumber(params.radiusX !== undefined ? params.radiusX : params.radius, DEFAULT_RADIUS, MIN_RADIUS);
            var radiusY = safeNumber(params.radiusY !== undefined ? params.radiusY : params.radius, DEFAULT_RADIUS, MIN_RADIUS);
            var startAngle = safeNumber(params.startAngle, DEFAULT_START_ANGLE);
            var spacing = safeNumber(params.spacing, DEFAULT_RING_SPACING);
            var scaleVal = safeNumber(params.scale, DEFAULT_SCALE, MIN_SCALE);
            var rotX = safeNumber(params.rotX, DEFAULT_ROT_X);
            var rotY = safeNumber(params.rotY, DEFAULT_ROT_Y);
            var rotZ = safeNumber(params.rotZ, DEFAULT_ROT_Z);

            var master = setupRingMasterNull(comp, radiusX, radiusY, startAngle, spacing, scaleVal, rotX, rotY, rotZ);
            if (!master) {
                reportError("Operation failed during Create Ring: Unable to create Master Null controller.");
                app.endUndoGroup();
                return false;
            }

            var totalCount = validLayers.length;
            for (var j = 0; j < totalCount; j++) {
                var card = validLayers[j];
                var is3D = card.threeDLayer;
                var origPos = getLayerPosition(card);
                var tg = card.property("ADBE Transform Group") || card.property("Transform");
                var origScale = [100, 100, 100];
                var origOrient = [0, 0, 0];
                var origRotX = 0, origRotY = 0, origRotZ = 0;

                if (tg) {
                    var sProp = tg.property("ADBE Scale") || tg.property("Scale");
                    if (sProp && sProp.value) origScale = sProp.value;
                    var oProp = tg.property("ADBE Orientation") || tg.property("Orientation");
                    if (oProp && oProp.value) origOrient = oProp.value;
                    var rxProp = tg.property("ADBE X Rotation") || tg.property("X Rotation");
                    if (rxProp && rxProp.value !== undefined) origRotX = rxProp.value;
                    var ryProp = tg.property("ADBE Y Rotation") || tg.property("Y Rotation");
                    if (ryProp && ryProp.value !== undefined) origRotY = ryProp.value;
                    var rzProp = tg.property("ADBE Z Rotation") || tg.property("Z Rotation");
                    if (rzProp && rzProp.value !== undefined) origRotZ = rzProp.value;
                }

                var metaObj = {
                    C3D_TYPE: "RING_CARD",
                    orig3D: is3D,
                    origParentName: (card.parent && card.parent.name) ? card.parent.name : null,
                    origParentIndex: (card.parent && card.parent.index) ? card.parent.index : null,
                    origPos: [origPos[0], origPos[1], origPos[2]],
                    origScale: [origScale[0], origScale[1], origScale[2]],
                    origOrient: [origOrient[0], origOrient[1], origOrient[2]],
                    origRotX: origRotX, origRotY: origRotY, origRotZ: origRotZ
                };
                
                var existingComment = card.comment || "";
                var cleanComment = removeMetadataFromComment(existingComment, META_RING_PREFIX);
                card.comment = cleanComment + META_RING_PREFIX + serializeMetadata(metaObj) + META_SUFFIX;
                card.parent = master;
            }

            var settings = { radiusX: radiusX, radiusY: radiusY, startAngle: startAngle, spacing: spacing, scale: scaleVal };
            applyRingLayout(comp, master, validLayers, settings);

            app.endUndoGroup();
            return true;

        } catch (err) {
            app.endUndoGroup();
            reportError("Operation failed during Create Ring:\n" + err.toString());
            return false;
        }
    }

    function updateRingCarousel(params, skipUndo) {
        var comp = getActiveComp();
        if (!comp) return reportError("No active composition found.", params && (params.silent || params.isLivePreview));

        var master = findRingMaster(comp);
        if (!master) return reportError("C3D_RING_MASTER not found in active composition. Use CREATE RING first.", params && (params.silent || params.isLivePreview));

        if (params && (params.silent || params.isLivePreview)) skipUndo = true;
        if (!skipUndo) app.beginUndoGroup("Update Ring Carousel – Motion by DK");

        try {
            var eRadiusX = getOrAddEffect(master, "ADBE Slider Control", "C3D Radius X");
            var eRadiusY = getOrAddEffect(master, "ADBE Slider Control", "C3D Radius Y");
            var eAngle = getOrAddEffect(master, "ADBE Slider Control", "C3D Start Angle");
            var eSpacing = getOrAddEffect(master, "ADBE Slider Control", "C3D Ring Spacing");
            var eScale = getOrAddEffect(master, "ADBE Slider Control", "C3D Scale");
            var eRotX = getOrAddEffect(master, "ADBE Slider Control", "C3D X Rotation");
            var eRotY = getOrAddEffect(master, "ADBE Slider Control", "C3D Y Rotation");
            var eRotZ = getOrAddEffect(master, "ADBE Slider Control", "C3D Z Rotation");

            try {
                var fxG = getEffectsGroup(master);
                if (fxG) {
                    var eAR = fxG.property("C3D Auto Rotate");
                    if (eAR) eAR.remove();
                    var eRS = fxG.property("C3D Rotation Speed");
                    if (eRS) eRS.remove();
                }
            } catch (eRemFx2) {}

            var radXVal = (params.radiusX !== undefined) ? params.radiusX : params.radius;
            var radYVal = (params.radiusY !== undefined) ? params.radiusY : params.radius;

            if (radXVal !== undefined) setEffectValue(eRadiusX, safeNumber(radXVal, DEFAULT_RADIUS, MIN_RADIUS));
            if (radYVal !== undefined) setEffectValue(eRadiusY, safeNumber(radYVal, DEFAULT_RADIUS, MIN_RADIUS));
            if (params.startAngle !== undefined) setEffectValue(eAngle, safeNumber(params.startAngle, DEFAULT_START_ANGLE));
            if (params.spacing !== undefined) setEffectValue(eSpacing, safeNumber(params.spacing, DEFAULT_RING_SPACING));
            if (params.scale !== undefined) setEffectValue(eScale, safeNumber(params.scale, DEFAULT_SCALE, MIN_SCALE));
            if (params.rotX !== undefined) setEffectValue(eRotX, safeNumber(params.rotX, DEFAULT_ROT_X));
            if (params.rotY !== undefined) setEffectValue(eRotY, safeNumber(params.rotY, DEFAULT_ROT_Y));
            if (params.rotZ !== undefined) setEffectValue(eRotZ, safeNumber(params.rotZ, DEFAULT_ROT_Z));

            var radiusX = getEffectValue(eRadiusX, safeNumber(radXVal, DEFAULT_RADIUS, MIN_RADIUS));
            var radiusY = getEffectValue(eRadiusY, safeNumber(radYVal, DEFAULT_RADIUS, MIN_RADIUS));
            var startAngle = getEffectValue(eAngle, safeNumber(params.startAngle, DEFAULT_START_ANGLE));
            var spacing = getEffectValue(eSpacing, safeNumber(params.spacing, DEFAULT_RING_SPACING));
            var scaleVal = getEffectValue(eScale, safeNumber(params.scale, DEFAULT_SCALE, MIN_SCALE));

            updateRingMasterRotationExpressions(master);

            var cards = getRingCarouselCards(comp, master);
            var settings = { radiusX: radiusX, radiusY: radiusY, startAngle: startAngle, spacing: spacing, scale: scaleVal };
            applyRingLayout(comp, master, cards, settings);

            if (!skipUndo) app.endUndoGroup();
            return true;

        } catch (err) {
            if (!skipUndo) app.endUndoGroup();
            reportError("Operation failed during Update Ring:\n" + err.toString(), (typeof params !== "undefined" && params) ? (params.silent || params.isLivePreview) : false);
            return false;
        }
    }

    function resetRingCarousel() {
        var comp = getActiveComp();
        if (!comp) return false;

        app.beginUndoGroup("Reset Ring Carousel – Motion by DK");
        try {
            var defaults = {
                radiusX: DEFAULT_RADIUS,
                radiusY: DEFAULT_RADIUS,
                startAngle: DEFAULT_START_ANGLE,
                spacing: DEFAULT_RING_SPACING,
                scale: DEFAULT_SCALE,
                rotX: DEFAULT_ROT_X,
                rotY: DEFAULT_ROT_Y,
                rotZ: DEFAULT_ROT_Z
            };

            var master = findRingMaster(comp);
            if (master) {
                updateRingCarousel(defaults, true);
            }
            app.endUndoGroup();
            return true;
        } catch (e) {
            app.endUndoGroup();
            return false;
        }
    }

    function deleteRingCarousel() {
        var comp = getActiveComp();
        if (!comp) return reportError("No active composition found.", (typeof params !== "undefined" && params) ? (params.silent || params.isLivePreview) : false);

        var master = findRingMaster(comp);
        var camera = findRingCamera(comp);
        if (!master && !camera) return reportError("No Ring Carousel controllers found in active composition.");

        app.beginUndoGroup("Delete Ring Carousel – Motion by DK");

        try {
            var cards = getRingCarouselCards(comp, master);

            for (var i = 0; i < cards.length; i++) {
                var card = cards[i];
                if (!card) continue;

                removeAllLayerExpressions(card);

                var metaObj = extractMetadataFromComment(card.comment, META_RING_PREFIX);
                if (metaObj) {
                    card.comment = removeMetadataFromComment(card.comment, META_RING_PREFIX);
                }

                var restoredParent = false;
                if (metaObj && metaObj.origParentName) {
                    try {
                        var pLayer = comp.layer(metaObj.origParentName);
                        if (pLayer && pLayer !== master && pLayer !== camera && !isCarouselMasterOrCamera(pLayer)) {
                            card.parent = pLayer;
                            restoredParent = true;
                        }
                    } catch (e1) {}
                }
                if (!restoredParent && metaObj && metaObj.origParentIndex) {
                    try {
                        var pLayerIdx = comp.layer(metaObj.origParentIndex);
                        if (pLayerIdx && pLayerIdx !== master && pLayerIdx !== camera && !isCarouselMasterOrCamera(pLayerIdx)) {
                            card.parent = pLayerIdx;
                            restoredParent = true;
                        }
                    } catch (e2) {}
                }
                if (!restoredParent) card.parent = null;

                if (metaObj) {
                    if (metaObj.origPos) setLayerPosition(card, metaObj.origPos[0], metaObj.origPos[1], metaObj.origPos[2]);
                    if (metaObj.origScale) setLayerScale(card, metaObj.origScale);
                    var tg = card.property("ADBE Transform Group") || card.property("Transform");
                    if (tg) {
                        if (metaObj.origOrient && tg.property("ADBE Orientation")) safeSetValue(tg.property("ADBE Orientation"), metaObj.origOrient);
                        if (metaObj.origRotX !== undefined && tg.property("ADBE X Rotation")) safeSetValue(tg.property("ADBE X Rotation"), metaObj.origRotX);
                        if (metaObj.origRotY !== undefined && tg.property("ADBE Y Rotation")) safeSetValue(tg.property("ADBE Y Rotation"), metaObj.origRotY);
                        if (metaObj.origRotZ !== undefined && tg.property("ADBE Z Rotation")) safeSetValue(tg.property("ADBE Z Rotation"), metaObj.origRotZ);
                    }
                    if (metaObj.orig3D !== undefined) { try { card.threeDLayer = metaObj.orig3D; } catch (e3D) {} }
                }
            }

            if (master) try { master.remove(); } catch (eRem1) {}
            if (camera) try { camera.remove(); } catch (eRem2) {}

            app.endUndoGroup();
            return true;

        } catch (err) {
            app.endUndoGroup();
            reportError("Operation failed during Delete Ring:\n" + err.toString());
            return false;
        }
    }

    // ------------------------------------------------------------------------
    // COVERFLOW CAROUSEL ENGINE (V1.0 - PERSPECTIVE 3D CARDS LAYOUT)
    // ------------------------------------------------------------------------
    function findCoverflowMaster(comp) {
        if (!comp) return null;
        for (var i = 1; i <= comp.numLayers; i++) {
            var l = comp.layer(i);
            if (!l) continue;
            var comment = l.comment || "";
            if (l.name === COVER_MASTER_NAME || comment.indexOf(TAG_COVER_MASTER) !== -1) {
                return l;
            }
        }
        return null;
    }

    function findCoverflowCamera(comp) {
        if (!comp) return null;
        for (var i = 1; i <= comp.numLayers; i++) {
            var l = comp.layer(i);
            if (!l) continue;
            var comment = l.comment || "";
            if (l.name === COVER_CAMERA_NAME || comment.indexOf(TAG_COVER_CAMERA) !== -1) {
                return l;
            }
        }
        return null;
    }

    function updateCoverflowMasterRotationExpressions(masterNull) {
        if (!masterNull) return;
        var tg = masterNull.property("ADBE Transform Group") || masterNull.property("Transform");
        if (!tg) return;

        var rxProp = tg.property("ADBE X Rotation") || tg.property("X Rotation");
        if (rxProp) safeSetExpression(rxProp, EXPR_OWNERSHIP_MARKER + "\n" + "effect('C3D X Rotation')(1).value;");

        var ryProp = tg.property("ADBE Y Rotation") || tg.property("Y Rotation");
        if (ryProp) safeSetExpression(ryProp, EXPR_OWNERSHIP_MARKER + "\n" + "effect('C3D Y Rotation')(1).value;");

        var rzProp = tg.property("ADBE Z Rotation") || tg.property("Z Rotation");
        if (rzProp) safeSetExpression(rzProp, EXPR_OWNERSHIP_MARKER + "\n" + "effect('C3D Z Rotation')(1).value;");
    }

    function setupCoverflowMasterNull(comp, spacing, angle, depthVal, sideScale, activeIdx, rotX, rotY, rotZ, enableShadow, shadowDist, shadowSoft, shadowOpac, enableBlur, maxBlur, isAnim, pauseDur, transDur) {
        if (!comp) return null;
        var master = findCoverflowMaster(comp);
        if (!master) {
            master = comp.layers.addNull();
            if (!master) return null;
            master.name = COVER_MASTER_NAME;
            master.comment = TAG_COVER_MASTER;
            master.guideLayer = true;
            master.label = 10;
        }

        try { master.threeDLayer = true; } catch (e) {}
        setLayerPosition(master, comp.width / 2, comp.height / 2, 0);

        setEffectValue(getOrAddEffect(master, "ADBE Slider Control", "C3D Active Index"), safeNumber(activeIdx, DEFAULT_COVER_INDEX, 1));
        setEffectValue(getOrAddEffect(master, "ADBE Slider Control", "C3D Card Spacing"), safeNumber(spacing, DEFAULT_COVER_SPACING, 10));
        setEffectValue(getOrAddEffect(master, "ADBE Slider Control", "C3D Tilt Angle"), safeNumber(angle, DEFAULT_COVER_ANGLE, -180, 180));
        setEffectValue(getOrAddEffect(master, "ADBE Slider Control", "C3D Depth Offset"), safeNumber(depthVal, DEFAULT_COVER_DEPTH, 0));
        setEffectValue(getOrAddEffect(master, "ADBE Slider Control", "C3D Side Scale"), safeNumber(sideScale, DEFAULT_COVER_SIDE_SCALE, 1, 200));
        setEffectValue(getOrAddEffect(master, "ADBE Slider Control", "C3D Scale"), safeNumber(DEFAULT_SCALE, DEFAULT_SCALE, MIN_SCALE));
        setEffectValue(getOrAddEffect(master, "ADBE Slider Control", "C3D X Rotation"), safeNumber(rotX, DEFAULT_ROT_X));
        setEffectValue(getOrAddEffect(master, "ADBE Slider Control", "C3D Y Rotation"), safeNumber(rotY, DEFAULT_ROT_Y));
        setEffectValue(getOrAddEffect(master, "ADBE Slider Control", "C3D Z Rotation"), safeNumber(rotZ, DEFAULT_ROT_Z));

        setEffectValue(getOrAddEffect(master, "ADBE Checkbox Control", "C3D Enable Shadow"), enableShadow !== false ? 1 : 0);
        setEffectValue(getOrAddEffect(master, "ADBE Slider Control", "C3D Shadow Distance"), safeNumber(shadowDist, DEFAULT_COVER_SHADOW_DIST, 0));
        setEffectValue(getOrAddEffect(master, "ADBE Slider Control", "C3D Shadow Softness"), safeNumber(shadowSoft, DEFAULT_COVER_SHADOW_SOFT, 0));
        setEffectValue(getOrAddEffect(master, "ADBE Slider Control", "C3D Shadow Opacity"), safeNumber(shadowOpac, DEFAULT_COVER_SHADOW_OPAC, 0, 100));

        setEffectValue(getOrAddEffect(master, "ADBE Checkbox Control", "C3D Enable Blur"), enableBlur === true ? 1 : 0);
        setEffectValue(getOrAddEffect(master, "ADBE Slider Control", "C3D Max Blur"), safeNumber(maxBlur, DEFAULT_COVER_MAX_BLUR, 0, 100));

        setEffectValue(getOrAddEffect(master, "ADBE Checkbox Control", "C3D Step Animation"), isAnim === true ? 1 : 0);
        setEffectValue(getOrAddEffect(master, "ADBE Slider Control", "C3D Pause Duration"), safeNumber(pauseDur, DEFAULT_EASY_PAUSE_DUR, 0.1));
        setEffectValue(getOrAddEffect(master, "ADBE Slider Control", "C3D Transition Duration"), safeNumber(transDur, DEFAULT_EASY_TRANS_DUR, 0.1));

        updateCoverflowMasterRotationExpressions(master);
        return master;
    }

    function getCoverflowCards(comp, masterNull) {
        var cards = [];
        if (!comp || !masterNull) return cards;

        for (var i = 1; i <= comp.numLayers; i++) {
            var l = comp.layer(i);
            if (!l) continue;
            var comment = l.comment || "";
            if (l.parent === masterNull && comment.indexOf(META_COVER_PREFIX) !== -1) {
                cards.push(l);
            }
        }
        return cards;
    }

    function applyCoverflowLayout(comp, masterNull, cards, settings) {
        if (!comp || !masterNull || !cards || cards.length === 0) return false;

        var totalCount = cards.length;

        for (var k = 0; k < totalCount; k++) {
            var card = cards[k];
            if (!card) continue;

            try { card.threeDLayer = true; } catch (e) {}
            card.parent = masterNull;

            var origScale = [100, 100, 100];
            var comment = card.comment || "";
            var metaObj = extractMetadataFromComment(comment, META_COVER_PREFIX);
            if (metaObj && metaObj.origScale) {
                origScale = metaObj.origScale;
            }

            var origX = (origScale && origScale[0] !== undefined) ? origScale[0] : 100;
            var origY = (origScale && origScale[1] !== undefined) ? origScale[1] : 100;
            var origZ = (origScale && origScale[2] !== undefined) ? origScale[2] : 100;

            // Position Expression (X Spacing & Z Depth Offset relative to Active Index)
            var posExpr = EXPR_OWNERSHIP_MARKER + "\n" +
                          "var ctrl = parent;\n" +
                          "var isAnim = ctrl.effect('C3D Step Animation')('Checkbox').value == 1;\n" +
                          "var activeIdx = ctrl.effect('C3D Active Index')('Slider').value;\n" +
                          "if (isAnim) {\n" +
                          "    var pauseD = Math.max(0.1, ctrl.effect('C3D Pause Duration')('Slider').value);\n" +
                          "    var transD = Math.max(0.1, ctrl.effect('C3D Transition Duration')('Slider').value);\n" +
                          "    var totalNum = " + totalCount + ";\n" +
                          "    var stepDur = pauseD + transD;\n" +
                          "    var cycleT = (time % (totalNum * stepDur));\n" +
                          "    var curStep = Math.floor(cycleT / stepDur);\n" +
                          "    var stepTime = cycleT - (curStep * stepDur);\n" +
                          "    var progress = Math.max(0, Math.min(1, (stepTime - pauseD) / transD));\n" +
                          "    var smoothP = progress * progress * (3 - 2 * progress);\n" +
                          "    activeIdx = 1 + ((curStep + smoothP) % totalNum);\n" +
                          "}\n" +
                          "var spacing = ctrl.effect('C3D Card Spacing')('Slider').value;\n" +
                          "var depthVal = ctrl.effect('C3D Depth Offset')('Slider').value;\n" +
                          "var cardIdx = " + (k + 1) + ";\n" +
                          "var offset = cardIdx - activeIdx;\n" +
                          "var posX = offset * spacing;\n" +
                          "var posZ = Math.abs(offset) * depthVal;\n" +
                          "[posX, 0, posZ];";
            setCardPositionExpression(card, posExpr);

            // Scale Expression (Center card 100%, side cards scaled down)
            var scaleExpr = EXPR_OWNERSHIP_MARKER + "\n" +
                            "var ctrl = parent;\n" +
                            "var isAnim = ctrl.effect('C3D Step Animation')('Checkbox').value == 1;\n" +
                            "var activeIdx = ctrl.effect('C3D Active Index')('Slider').value;\n" +
                            "if (isAnim) {\n" +
                            "    var pauseD = Math.max(0.1, ctrl.effect('C3D Pause Duration')('Slider').value);\n" +
                            "    var transD = Math.max(0.1, ctrl.effect('C3D Transition Duration')('Slider').value);\n" +
                            "    var totalNum = " + totalCount + ";\n" +
                            "    var stepDur = pauseD + transD;\n" +
                            "    var cycleT = (time % (totalNum * stepDur));\n" +
                            "    var curStep = Math.floor(cycleT / stepDur);\n" +
                            "    var stepTime = cycleT - (curStep * stepDur);\n" +
                            "    var progress = Math.max(0, Math.min(1, (stepTime - pauseD) / transD));\n" +
                            "    var smoothP = progress * progress * (3 - 2 * progress);\n" +
                            "    activeIdx = 1 + ((curStep + smoothP) % totalNum);\n" +
                            "}\n" +
                            "var baseScale = ctrl.effect('C3D Scale')(1).value / 100;\n" +
                            "var sideScalePct = ctrl.effect('C3D Side Scale')('Slider').value / 100;\n" +
                            "var cardIdx = " + (k + 1) + ";\n" +
                            "var offset = Math.abs(cardIdx - activeIdx);\n" +
                            "var scaleFactor = 1.0;\n" +
                            "if (offset < 1) {\n" +
                            "    scaleFactor = 1.0 - (1.0 - sideScalePct) * offset;\n" +
                            "} else {\n" +
                            "    scaleFactor = sideScalePct;\n" +
                            "}\n" +
                            "var totalFactor = baseScale * scaleFactor;\n" +
                            "[" + origX + " * totalFactor, " + origY + " * totalFactor, " + origZ + " * totalFactor];";
            setCardScaleExpression(card, scaleExpr);

            // Y Rotation Expression (Center card 0°, left cards +Angle, right cards -Angle)
            var tgCard = card.property("ADBE Transform Group") || card.property("Transform");
            if (tgCard) {
                var oProp = tgCard.property("ADBE Orientation") || tgCard.property("Orientation");
                if (oProp) { safeSetExpression(oProp, ""); safeSetValue(oProp, [0, 0, 0]); }

                var rxProp = tgCard.property("ADBE X Rotation") || tgCard.property("X Rotation");
                if (rxProp) { safeSetExpression(rxProp, ""); safeSetValue(rxProp, 0); }

                var rzProp = tgCard.property("ADBE Z Rotation") || tgCard.property("Z Rotation");
                if (rzProp) { safeSetExpression(rzProp, ""); safeSetValue(rzProp, 0); }

                var ryProp = tgCard.property("ADBE Y Rotation") || tgCard.property("Y Rotation");
                if (ryProp) {
                    var rotYExpr = EXPR_OWNERSHIP_MARKER + "\n" +
                                   "var ctrl = parent;\n" +
                                   "var isAnim = ctrl.effect('C3D Step Animation')('Checkbox').value == 1;\n" +
                                   "var activeIdx = ctrl.effect('C3D Active Index')('Slider').value;\n" +
                                   "if (isAnim) {\n" +
                                   "    var pauseD = Math.max(0.1, ctrl.effect('C3D Pause Duration')('Slider').value);\n" +
                                   "    var transD = Math.max(0.1, ctrl.effect('C3D Transition Duration')('Slider').value);\n" +
                                   "    var totalNum = " + totalCount + ";\n" +
                                   "    var stepDur = pauseD + transD;\n" +
                                   "    var cycleT = (time % (totalNum * stepDur));\n" +
                                   "    var curStep = Math.floor(cycleT / stepDur);\n" +
                                   "    var stepTime = cycleT - (curStep * stepDur);\n" +
                                   "    var progress = Math.max(0, Math.min(1, (stepTime - pauseD) / transD));\n" +
                                   "    var smoothP = progress * progress * (3 - 2 * progress);\n" +
                                   "    activeIdx = 1 + ((curStep + smoothP) % totalNum);\n" +
                                   "}\n" +
                                   "var sideAngle = ctrl.effect('C3D Tilt Angle')('Slider').value;\n" +
                                   "var cardIdx = " + (k + 1) + ";\n" +
                                   "var offset = cardIdx - activeIdx;\n" +
                                   "var factor = Math.max(-1, Math.min(1, offset));\n" +
                                   "-factor * sideAngle;";
                    safeSetExpression(ryProp, rotYExpr);
                }
            }

            // Drop Shadow Setup (ADBE Drop Shadow)
            var shFx = getOrAddEffect(card, "ADBE Drop Shadow", "C3D Drop Shadow");
            if (shFx && typeof shFx.property === "function") {
                var shDist = shFx.property("Distance") || shFx.property("ADBE Drop Shadow-0002") || shFx.property(2);
                if (shDist) safeSetExpression(shDist, EXPR_OWNERSHIP_MARKER + "\n" + "var ctrl = parent;\nif (ctrl.effect('C3D Enable Shadow')(1).value == 1) { ctrl.effect('C3D Shadow Distance')(1).value; } else { 0; }");

                var shSoft = shFx.property("Softness") || shFx.property("ADBE Drop Shadow-0003") || shFx.property(3);
                if (shSoft) safeSetExpression(shSoft, EXPR_OWNERSHIP_MARKER + "\n" + "var ctrl = parent;\nif (ctrl.effect('C3D Enable Shadow')(1).value == 1) { ctrl.effect('C3D Shadow Softness')(1).value; } else { 0; }");

                var shOpac = shFx.property("Opacity") || shFx.property("ADBE Drop Shadow-0001") || shFx.property(1);
                if (shOpac) safeSetExpression(shOpac, EXPR_OWNERSHIP_MARKER + "\n" + "var ctrl = parent;\nif (ctrl.effect('C3D Enable Shadow')(1).value == 1) { (ctrl.effect('C3D Shadow Opacity')(1).value / 100) * 255; } else { 0; }");
            }

            // Depth Blur Setup (ADBE Fast Blur / Gaussian Blur)
            var blurFx = getOrAddEffect(card, "ADBE Fast Blur", "C3D Depth Blur");
            if (!blurFx) blurFx = getOrAddEffect(card, "ADBE Gaussian Blur 2", "C3D Depth Blur");
            if (!blurFx) blurFx = getOrAddEffect(card, "ADBE Gaussian Blur", "C3D Depth Blur");

            if (blurFx && typeof blurFx.property === "function") {
                var blurProp = blurFx.property("Blurriness") || blurFx.property("ADBE Fast Blur-0001") || blurFx.property("ADBE Gaussian Blur 2-0001");
                if (blurProp) {
                    var blurExpr = EXPR_OWNERSHIP_MARKER + "\n" +
                                   "var ctrl = parent;\n" +
                                   "var enableB = ctrl.effect('C3D Enable Blur')('Checkbox').value == 1;\n" +
                                   "if (!enableB) { 0; } else {\n" +
                                   "    var isAnim = ctrl.effect('C3D Step Animation')('Checkbox').value == 1;\n" +
                                   "    var activeIdx = ctrl.effect('C3D Active Index')('Slider').value;\n" +
                                   "    if (isAnim) {\n" +
                                   "        var pauseD = Math.max(0.1, ctrl.effect('C3D Pause Duration')('Slider').value);\n" +
                                   "        var transD = Math.max(0.1, ctrl.effect('C3D Transition Duration')('Slider').value);\n" +
                                   "        var totalNum = " + totalCount + ";\n" +
                                   "        var stepDur = pauseD + transD;\n" +
                                   "        var cycleT = (time % (totalNum * stepDur));\n" +
                                   "        var curStep = Math.floor(cycleT / stepDur);\n" +
                                   "        var stepTime = cycleT - (curStep * stepDur);\n" +
                                   "        var progress = Math.max(0, Math.min(1, (stepTime - pauseD) / transD));\n" +
                                   "        var smoothP = progress * progress * (3 - 2 * progress);\n" +
                                   "        activeIdx = 1 + ((curStep + smoothP) % totalNum);\n" +
                                   "    }\n" +
                                   "    var maxBlur = ctrl.effect('C3D Max Blur')('Slider').value;\n" +
                                   "    var cardIdx = " + (k + 1) + ";\n" +
                                   "    var offset = Math.abs(cardIdx - activeIdx);\n" +
                                   "    Math.min(maxBlur, offset * (maxBlur / 2));\n" +
                                   "}";
                    safeSetExpression(blurProp, blurExpr);
                }
            }
        }

        updateCoverflowMasterRotationExpressions(masterNull);
        return true;
    }

    function createCoverflowCarousel(params) {
        var comp = getActiveComp();
        if (!comp) {
            reportError("No active composition found. Please open a composition in After Effects.");
            return false;
        }

        var selected = comp.selectedLayers;
        if (!selected || selected.length === 0) {
            reportError("Please select at least 2 artwork layers in the active composition.");
            return false;
        }

        var validLayers = [];
        for (var i = 0; i < selected.length; i++) {
            var l = selected[i];
            if (!l) continue;
            if (!isCarouselMasterOrCamera(l)) {
                validLayers.push(l);
            }
        }

        if (validLayers.length < 2) {
            reportError("Please select at least 2 artwork layers in the active composition.");
            return false;
        }

        if (findCoverflowMaster(comp)) {
            reportError("Coverflow Carousel already exists in this composition. Use UPDATE or DELETE.");
            return false;
        }

        app.beginUndoGroup("Create Coverflow Carousel – Motion by DK");

        try {
            var spacing = safeNumber(params.coverSpacing !== undefined ? params.coverSpacing : params.spacing, DEFAULT_COVER_SPACING, 10);
            var angle = safeNumber(params.coverAngle, DEFAULT_COVER_ANGLE, -180, 180);
            var depthVal = safeNumber(params.coverDepth, DEFAULT_COVER_DEPTH, 0);
            var sideScale = safeNumber(params.sideScale, DEFAULT_COVER_SIDE_SCALE, 1, 200);
            var activeIdx = safeNumber(params.activeIndex, DEFAULT_COVER_INDEX, 1);
            var rotX = safeNumber(params.rotX, DEFAULT_ROT_X);
            var rotY = safeNumber(params.rotY, DEFAULT_ROT_Y);
            var rotZ = safeNumber(params.rotZ, DEFAULT_ROT_Z);

            var enableShadow = params.enableShadow !== false;
            var shadowDist = safeNumber(params.shadowDist, DEFAULT_COVER_SHADOW_DIST, 0);
            var shadowSoft = safeNumber(params.shadowSoft, DEFAULT_COVER_SHADOW_SOFT, 0);
            var shadowOpac = safeNumber(params.shadowOpac, DEFAULT_COVER_SHADOW_OPAC, 0, 100);

            var enableBlur = params.enableBlur === true;
            var maxBlur = safeNumber(params.maxBlur, DEFAULT_COVER_MAX_BLUR, 0, 100);

            var isAnim = params.isAnim === true;
            var pauseDur = safeNumber(params.pauseDur, DEFAULT_EASY_PAUSE_DUR, 0.1);
            var transDur = safeNumber(params.transDur, DEFAULT_EASY_TRANS_DUR, 0.1);

            var master = setupCoverflowMasterNull(comp, spacing, angle, depthVal, sideScale, activeIdx, rotX, rotY, rotZ, enableShadow, shadowDist, shadowSoft, shadowOpac, enableBlur, maxBlur, isAnim, pauseDur, transDur);
            if (!master) {
                reportError("Operation failed during Create Coverflow: Unable to create Master Null controller.");
                app.endUndoGroup();
                return false;
            }

            var totalCount = validLayers.length;
            for (var j = 0; j < totalCount; j++) {
                var card = validLayers[j];
                var is3D = card.threeDLayer;
                var origPos = getLayerPosition(card);
                var tg = card.property("ADBE Transform Group") || card.property("Transform");
                var origScale = [100, 100, 100];
                var origOrient = [0, 0, 0];
                var origRotX = 0, origRotY = 0, origRotZ = 0;

                if (tg) {
                    var sProp = tg.property("ADBE Scale") || tg.property("Scale");
                    if (sProp && sProp.value) origScale = sProp.value;
                    var oProp = tg.property("ADBE Orientation") || tg.property("Orientation");
                    if (oProp && oProp.value) origOrient = oProp.value;
                    var rxProp = tg.property("ADBE X Rotation") || tg.property("X Rotation");
                    if (rxProp && rxProp.value !== undefined) origRotX = rxProp.value;
                    var ryProp = tg.property("ADBE Y Rotation") || tg.property("Y Rotation");
                    if (ryProp && ryProp.value !== undefined) origRotY = ryProp.value;
                    var rzProp = tg.property("ADBE Z Rotation") || tg.property("Z Rotation");
                    if (rzProp && rzProp.value !== undefined) origRotZ = rzProp.value;
                }

                var metaObj = {
                    C3D_TYPE: "COVER_CARD",
                    orig3D: is3D,
                    origParentName: (card.parent && card.parent.name) ? card.parent.name : null,
                    origParentIndex: (card.parent && card.parent.index) ? card.parent.index : null,
                    origPos: [origPos[0], origPos[1], origPos[2]],
                    origScale: [origScale[0], origScale[1], origScale[2]],
                    origOrient: [origOrient[0], origOrient[1], origOrient[2]],
                    origRotX: origRotX, origRotY: origRotY, origRotZ: origRotZ
                };
                
                var existingComment = card.comment || "";
                var cleanComment = removeMetadataFromComment(existingComment, META_COVER_PREFIX);
                card.comment = cleanComment + META_COVER_PREFIX + serializeMetadata(metaObj) + META_SUFFIX;
                card.parent = master;
            }

            applyCoverflowLayout(comp, master, validLayers, {});

            app.endUndoGroup();
            return true;

        } catch (err) {
            app.endUndoGroup();
            reportError("Operation failed during Create Coverflow:\n" + err.toString());
            return false;
        }
    }

    function updateCoverflowCarousel(params, skipUndo) {
        var comp = getActiveComp();
        if (!comp) return reportError("No active composition found.", params && (params.silent || params.isLivePreview));

        var master = findCoverflowMaster(comp);
        if (!master) return reportError("C3D_COVER_MASTER not found in active composition. Use CREATE COVERFLOW first.", params && (params.silent || params.isLivePreview));

        if (params && (params.silent || params.isLivePreview)) skipUndo = true;
        if (!skipUndo) app.beginUndoGroup("Update Coverflow Carousel – Motion by DK");

        try {
            var eActive = getOrAddEffect(master, "ADBE Slider Control", "C3D Active Index");
            var eSpacing = getOrAddEffect(master, "ADBE Slider Control", "C3D Card Spacing");
            var eAngle = getOrAddEffect(master, "ADBE Slider Control", "C3D Tilt Angle");
            var eDepth = getOrAddEffect(master, "ADBE Slider Control", "C3D Depth Offset");
            var eSideScale = getOrAddEffect(master, "ADBE Slider Control", "C3D Side Scale");
            var eScale = getOrAddEffect(master, "ADBE Slider Control", "C3D Scale");
            var eRotX = getOrAddEffect(master, "ADBE Slider Control", "C3D X Rotation");
            var eRotY = getOrAddEffect(master, "ADBE Slider Control", "C3D Y Rotation");
            var eRotZ = getOrAddEffect(master, "ADBE Slider Control", "C3D Z Rotation");

            var eEnableShadow = getOrAddEffect(master, "ADBE Checkbox Control", "C3D Enable Shadow");
            var eShadowDist = getOrAddEffect(master, "ADBE Slider Control", "C3D Shadow Distance");
            var eShadowSoft = getOrAddEffect(master, "ADBE Slider Control", "C3D Shadow Softness");
            var eShadowOpac = getOrAddEffect(master, "ADBE Slider Control", "C3D Shadow Opacity");

            var eEnableBlur = getOrAddEffect(master, "ADBE Checkbox Control", "C3D Enable Blur");
            var eMaxBlur = getOrAddEffect(master, "ADBE Slider Control", "C3D Max Blur");

            var eAnim = getOrAddEffect(master, "ADBE Checkbox Control", "C3D Step Animation");
            var ePause = getOrAddEffect(master, "ADBE Slider Control", "C3D Pause Duration");
            var eTrans = getOrAddEffect(master, "ADBE Slider Control", "C3D Transition Duration");

            var spVal = (params.coverSpacing !== undefined) ? params.coverSpacing : params.spacing;
            if (params.activeIndex !== undefined) setEffectValue(eActive, safeNumber(params.activeIndex, DEFAULT_COVER_INDEX, 1));
            if (spVal !== undefined) setEffectValue(eSpacing, safeNumber(spVal, DEFAULT_COVER_SPACING, 10));
            if (params.coverAngle !== undefined) setEffectValue(eAngle, safeNumber(params.coverAngle, DEFAULT_COVER_ANGLE, -180, 180));
            if (params.coverDepth !== undefined) setEffectValue(eDepth, safeNumber(params.coverDepth, DEFAULT_COVER_DEPTH, 0));
            if (params.sideScale !== undefined) setEffectValue(eSideScale, safeNumber(params.sideScale, DEFAULT_COVER_SIDE_SCALE, 1, 200));
            if (params.scale !== undefined) setEffectValue(eScale, safeNumber(params.scale, DEFAULT_SCALE, MIN_SCALE));
            if (params.rotX !== undefined) setEffectValue(eRotX, safeNumber(params.rotX, DEFAULT_ROT_X));
            if (params.rotY !== undefined) setEffectValue(eRotY, safeNumber(params.rotY, DEFAULT_ROT_Y));
            if (params.rotZ !== undefined) setEffectValue(eRotZ, safeNumber(params.rotZ, DEFAULT_ROT_Z));

            if (params.enableShadow !== undefined) setEffectValue(eEnableShadow, params.enableShadow ? 1 : 0);
            if (params.shadowDist !== undefined) setEffectValue(eShadowDist, safeNumber(params.shadowDist, DEFAULT_COVER_SHADOW_DIST, 0));
            if (params.shadowSoft !== undefined) setEffectValue(eShadowSoft, safeNumber(params.shadowSoft, DEFAULT_COVER_SHADOW_SOFT, 0));
            if (params.shadowOpac !== undefined) setEffectValue(eShadowOpac, safeNumber(params.shadowOpac, DEFAULT_COVER_SHADOW_OPAC, 0, 100));

            if (params.enableBlur !== undefined) setEffectValue(eEnableBlur, params.enableBlur ? 1 : 0);
            if (params.maxBlur !== undefined) setEffectValue(eMaxBlur, safeNumber(params.maxBlur, DEFAULT_COVER_MAX_BLUR, 0, 100));

            if (params.isAnim !== undefined) setEffectValue(eAnim, params.isAnim ? 1 : 0);
            if (params.pauseDur !== undefined) setEffectValue(ePause, safeNumber(params.pauseDur, DEFAULT_EASY_PAUSE_DUR, 0.1));
            if (params.transDur !== undefined) setEffectValue(eTrans, safeNumber(params.transDur, DEFAULT_EASY_TRANS_DUR, 0.1));

            updateCoverflowMasterRotationExpressions(master);

            var cards = getCoverflowCards(comp, master);
            applyCoverflowLayout(comp, master, cards, {});

            if (!skipUndo) app.endUndoGroup();
            return true;

        } catch (err) {
            if (!skipUndo) app.endUndoGroup();
            reportError("Operation failed during Update Coverflow:\n" + err.toString(), (typeof params !== "undefined" && params) ? (params.silent || params.isLivePreview) : false);
            return false;
        }
    }

    function resetCoverflowCarousel() {
        var comp = getActiveComp();
        if (!comp) return false;

        app.beginUndoGroup("Reset Coverflow Carousel – Motion by DK");
        try {
            var defaults = {
                coverSpacing: DEFAULT_COVER_SPACING,
                coverAngle: DEFAULT_COVER_ANGLE,
                coverDepth: DEFAULT_COVER_DEPTH,
                sideScale: DEFAULT_COVER_SIDE_SCALE,
                activeIndex: DEFAULT_COVER_INDEX,
                scale: DEFAULT_SCALE,
                rotX: DEFAULT_ROT_X,
                rotY: DEFAULT_ROT_Y,
                rotZ: DEFAULT_ROT_Z,
                enableShadow: true,
                shadowDist: DEFAULT_COVER_SHADOW_DIST,
                shadowSoft: DEFAULT_COVER_SHADOW_SOFT,
                shadowOpac: DEFAULT_COVER_SHADOW_OPAC,
                enableBlur: false,
                maxBlur: DEFAULT_COVER_MAX_BLUR,
                isAnim: false,
                pauseDur: DEFAULT_EASY_PAUSE_DUR,
                transDur: DEFAULT_EASY_TRANS_DUR
            };

            var master = findCoverflowMaster(comp);
            if (master) {
                updateCoverflowCarousel(defaults, true);
            }
            app.endUndoGroup();
            return true;
        } catch (e) {
            app.endUndoGroup();
            return false;
        }
    }

    function deleteCoverflowCarousel() {
        var comp = getActiveComp();
        if (!comp) return reportError("No active composition found.", (typeof params !== "undefined" && params) ? (params.silent || params.isLivePreview) : false);

        var master = findCoverflowMaster(comp);
        var camera = findCoverflowCamera(comp);
        if (!master && !camera) return reportError("No Coverflow Carousel controllers found in active composition.");

        app.beginUndoGroup("Delete Coverflow Carousel – Motion by DK");

        try {
            var cards = getCoverflowCards(comp, master);

            for (var i = 0; i < cards.length; i++) {
                var card = cards[i];
                if (!card) continue;

                removeAllLayerExpressions(card);

                // Clean up Drop Shadow & Depth Blur effects
                try {
                    var fxG = getEffectsGroup(card);
                    if (fxG) {
                        var eSh = fxG.property("C3D Drop Shadow");
                        if (eSh) eSh.remove();
                        var eBl = fxG.property("C3D Depth Blur");
                        if (eBl) eBl.remove();
                    }
                } catch (eRemFx) {}

                var metaObj = extractMetadataFromComment(card.comment, META_COVER_PREFIX);
                if (metaObj) {
                    card.comment = removeMetadataFromComment(card.comment, META_COVER_PREFIX);
                }

                var restoredParent = false;
                if (metaObj && metaObj.origParentName) {
                    try {
                        var pLayer = comp.layer(metaObj.origParentName);
                        if (pLayer && pLayer !== master && pLayer !== camera && !isCarouselMasterOrCamera(pLayer)) {
                            card.parent = pLayer;
                            restoredParent = true;
                        }
                    } catch (e1) {}
                }
                if (!restoredParent && metaObj && metaObj.origParentIndex) {
                    try {
                        var pLayerIdx = comp.layer(metaObj.origParentIndex);
                        if (pLayerIdx && pLayerIdx !== master && pLayerIdx !== camera && !isCarouselMasterOrCamera(pLayerIdx)) {
                            card.parent = pLayerIdx;
                            restoredParent = true;
                        }
                    } catch (e2) {}
                }
                if (!restoredParent) card.parent = null;

                if (metaObj) {
                    if (metaObj.origPos) setLayerPosition(card, metaObj.origPos[0], metaObj.origPos[1], metaObj.origPos[2]);
                    if (metaObj.origScale) setLayerScale(card, metaObj.origScale);
                    var tg = card.property("ADBE Transform Group") || card.property("Transform");
                    if (tg) {
                        if (metaObj.origOrient && tg.property("ADBE Orientation")) safeSetValue(tg.property("ADBE Orientation"), metaObj.origOrient);
                        if (metaObj.origRotX !== undefined && tg.property("ADBE X Rotation")) safeSetValue(tg.property("ADBE X Rotation"), metaObj.origRotX);
                        if (metaObj.origRotY !== undefined && tg.property("ADBE Y Rotation")) safeSetValue(tg.property("ADBE Y Rotation"), metaObj.origRotY);
                        if (metaObj.origRotZ !== undefined && tg.property("ADBE Z Rotation")) safeSetValue(tg.property("ADBE Z Rotation"), metaObj.origRotZ);
                    }
                    if (metaObj.orig3D !== undefined) { try { card.threeDLayer = metaObj.orig3D; } catch (e3D) {} }
                }
            }

            if (master) try { master.remove(); } catch (eRem1) {}
            if (camera) try { camera.remove(); } catch (eRem2) {}

            app.endUndoGroup();
            return true;

        } catch (err) {
            app.endUndoGroup();
            reportError("Operation failed during Delete Coverflow:\n" + err.toString());
            return false;
        }
    }

    // ------------------------------------------------------------------------
    // NATIVE SCRIPTUI PANEL INTERFACE
    // ------------------------------------------------------------------------
    function buildUI(thisObj) {
        var win = (thisObj instanceof Panel) ? thisObj : new Window("palette", "Motion by DK – 3D Carousel", undefined, { resizeable: true });
        win.orientation = "column";
        win.alignChildren = ["fill", "top"];
        win.spacing = 6;
        win.margins = 10;

        var isUpdating = false;

        // Header Panel
        var pnlHeader = win.add("panel", undefined, "");
        pnlHeader.orientation = "row";
        pnlHeader.alignChildren = ["left", "center"];
        pnlHeader.margins = 6;
        var txtBrand = pnlHeader.add("statictext", undefined, "Motion by DK");
        txtBrand.graphics.font = ScriptUI.newFont(txtBrand.graphics.font.family, "BOLD", 13);
        var txtSub = pnlHeader.add("statictext", undefined, "3D Carousel v2.2 (Circle & Easy 3D Edition)");
        txtSub.graphics.foregroundColor = txtSub.graphics.newPen(win.graphics.PenType.SOLID_COLOR, [1.0, 0.69, 0.0, 1], 1);

        // Layout Selector Group
        var rowLayout = win.add("group");
        rowLayout.orientation = "row";
        rowLayout.alignChildren = ["left", "center"];
        rowLayout.add("statictext", [0, 0, 70, 18], "Layout:");
        var ddLayout = rowLayout.add("dropdownlist", undefined, ["Circle", "Easy 3D Carousel", "3D Sphere Distributor", "Ring Carousel", "Coverflow Carousel"]);
        ddLayout.selection = 0;

        // Controls Helper
        function addSliderRow(parentGroup, labelText, minVal, maxVal, defaultVal, isInt) {
            var row = parentGroup.add("group");
            row.orientation = "row";
            row.alignChildren = ["left", "center"];

            var lbl = row.add("statictext", [0, 0, 100, 18], labelText);
            var slider = row.add("slider", [0, 0, 110, 18], defaultVal, minVal, maxVal);
            var edit = row.add("edittext", [0, 0, 50, 18], isInt ? defaultVal.toString() : defaultVal.toFixed(1));

            var rowObj = { row: row, lbl: lbl, slider: slider, edit: edit, isInt: isInt };

            slider.onChanging = function () {
                edit.text = rowObj.isInt ? Math.round(slider.value).toString() : slider.value.toFixed(1);
            };

            slider.onChange = function () {
                edit.text = rowObj.isInt ? Math.round(slider.value).toString() : slider.value.toFixed(1);
                triggerLivePreview();
            };

            edit.onChange = function () {
                var val = parseFloat(edit.text);
                if (isNaN(val)) val = defaultVal;
                var currentMin = (slider.minvalue !== undefined) ? slider.minvalue : minVal;
                var currentMax = (slider.maxvalue !== undefined) ? slider.maxvalue : maxVal;
                val = Math.max(currentMin, Math.min(currentMax, val));
                slider.value = val;
                edit.text = rowObj.isInt ? Math.round(val).toString() : val.toFixed(1);
                triggerLivePreview();
            };

            return rowObj;
        }

        var pnlControls = win.add("group");
        pnlControls.orientation = "column";
        pnlControls.alignChildren = ["fill", "top"];
        pnlControls.spacing = 2;
        pnlControls.margins = 0;

        // Helper getters for active layout controls
        function getActiveRadiusCtrl() {
            var selIndex = (ddLayout.selection) ? ddLayout.selection.index : 0;
            if (selIndex === 3) return ctrlRadius_Ring;
            if (selIndex === 2) return ctrlRadius_Sphere;
            if (selIndex === 1) return ctrlRadius_Easy;
            return ctrlRadius;
        }

        function getActiveStartAngleCtrl() {
            var selIndex = (ddLayout.selection) ? ddLayout.selection.index : 0;
            if (selIndex === 3) return ctrlStartAngle_Ring;
            if (selIndex === 2) return ctrlStartAngle_Sphere;
            if (selIndex === 1) return ctrlStartAngle_Easy;
            return ctrlStartAngle;
        }

        function getActiveBackScaleCtrl() {
            var selIndex = (ddLayout.selection) ? ddLayout.selection.index : 0;
            if (selIndex === 2) return ctrlBackScale_Sphere;
            return ctrlBackScale;
        }

        function getActiveScaleExpCtrl() {
            var selIndex = (ddLayout.selection) ? ddLayout.selection.index : 0;
            if (selIndex === 2) return ctrlScaleExp_Sphere;
            return ctrlScaleExp;
        }

        function getActiveMaxBlurCtrl() {
            var selIndex = (ddLayout.selection) ? ddLayout.selection.index : 0;
            if (selIndex === 4) return ctrlMaxBlur_Cover;
            return ctrlMaxBlur_Sphere;
        }

        function getActivePauseDurCtrl() {
            var selIndex = (ddLayout.selection) ? ddLayout.selection.index : 0;
            if (selIndex === 4) return ctrlPauseDur_Cover;
            return ctrlPauseDur;
        }

        function getActiveTransDurCtrl() {
            var selIndex = (ddLayout.selection) ? ddLayout.selection.index : 0;
            if (selIndex === 4) return ctrlTransDur_Cover;
            return ctrlTransDur;
        }

        // Container Group for Layout-Specific Controls (Stack mode overlays sub-groups at Y=0)
        var grpLayoutSpecific = pnlControls.add("group");
        grpLayoutSpecific.orientation = "stack";
        grpLayoutSpecific.alignChildren = ["fill", "top"];
        grpLayoutSpecific.spacing = 0;
        grpLayoutSpecific.margins = 0;

        // 1. Circle Group
        var grpCircle = grpLayoutSpecific.add("group");
        grpCircle.orientation = "column";
        grpCircle.alignChildren = ["fill", "top"];
        grpCircle.spacing = 2; grpCircle.margins = 0;
        var ctrlRadius = addSliderRow(grpCircle, "Radius:", MIN_RADIUS, 3000, DEFAULT_RADIUS, true);
        var ctrlStartAngle = addSliderRow(grpCircle, "Start Angle:", -360, 360, DEFAULT_START_ANGLE, true);
        var ctrlSpacing = addSliderRow(grpCircle, "Spacing:", 10, 720, DEFAULT_CIRCLE_SPACING, true);

        // 2. Ring Group
        var grpRing = grpLayoutSpecific.add("group");
        grpRing.orientation = "column";
        grpRing.alignChildren = ["fill", "top"];
        grpRing.spacing = 2; grpRing.margins = 0; grpRing.visible = false;
        var ctrlRadius_Ring = addSliderRow(grpRing, "Radius X:", MIN_RADIUS, 3000, DEFAULT_RADIUS, true);
        var ctrlRadiusY = addSliderRow(grpRing, "Radius Y:", MIN_RADIUS, 3000, DEFAULT_RADIUS, true);
        var ctrlStartAngle_Ring = addSliderRow(grpRing, "Start Angle:", -360, 360, DEFAULT_START_ANGLE, true);
        var ctrlRingSpacing = addSliderRow(grpRing, "Ring Spacing:", 10, 720, DEFAULT_RING_SPACING, true);

        // 3. Sphere Group
        var grpSphere = grpLayoutSpecific.add("group");
        grpSphere.orientation = "column";
        grpSphere.alignChildren = ["fill", "top"];
        grpSphere.spacing = 2; grpSphere.margins = 0; grpSphere.visible = false;
        var ctrlRadius_Sphere = addSliderRow(grpSphere, "Radius:", MIN_RADIUS, 3000, DEFAULT_RADIUS, true);
        var ctrlStartAngle_Sphere = addSliderRow(grpSphere, "Start Angle:", -360, 360, DEFAULT_START_ANGLE, true);
        var ctrlBackScale_Sphere = addSliderRow(grpSphere, "Back Scale (%):", 0, 100, DEFAULT_SPHERE_BACK_SCALE, true);
        var ctrlScaleExp_Sphere = addSliderRow(grpSphere, "Scale Exponent:", 0.1, 5.0, DEFAULT_SPHERE_SCALE_EXP, false);
        var ctrlMaxBlur_Sphere = addSliderRow(grpSphere, "Max Blur (px):", 0, 100, DEFAULT_SPHERE_MAX_BLUR, true);
        var rowSphereOpts = grpSphere.add("group");
        rowSphereOpts.orientation = "row";
        rowSphereOpts.alignChildren = ["left", "center"];
        var chkFaceCamera = rowSphereOpts.add("checkbox", undefined, "Face Camera Flat");
        chkFaceCamera.value = true;
        chkFaceCamera.onClick = function () { triggerLivePreview(); };

        // 4. Easy 3D Group
        var grpEasy = grpLayoutSpecific.add("group");
        grpEasy.orientation = "column";
        grpEasy.alignChildren = ["fill", "top"];
        grpEasy.spacing = 2; grpEasy.margins = 0; grpEasy.visible = false;
        var ctrlRadius_Easy = addSliderRow(grpEasy, "Radius:", MIN_RADIUS, 3000, DEFAULT_RADIUS, true);
        var ctrlStartAngle_Easy = addSliderRow(grpEasy, "Start Angle:", -360, 360, DEFAULT_START_ANGLE, true);
        var ctrlBackScale = addSliderRow(grpEasy, "Back Scale (%):", 0, 100, DEFAULT_EASY_BACK_SCALE, true);
        var ctrlScaleExp = addSliderRow(grpEasy, "Scale Exponent:", 0.1, 5.0, DEFAULT_EASY_SCALE_EXP, false);
        var ctrlBackOpacity = addSliderRow(grpEasy, "Back Opacity (%):", 0, 100, DEFAULT_EASY_BACK_OPACITY, true);
        var ctrlOpacExp = addSliderRow(grpEasy, "Opacity Exp:", 0.1, 5.0, DEFAULT_EASY_OPAC_EXP, false);
        var rowEasyOpts = grpEasy.add("group");
        rowEasyOpts.orientation = "row";
        rowEasyOpts.alignChildren = ["left", "center"];
        var chkAnimated = rowEasyOpts.add("checkbox", undefined, "Step Animation");
        chkAnimated.value = false;
        chkAnimated.onClick = function () { triggerLivePreview(); };
        var chkVertMode = rowEasyOpts.add("checkbox", undefined, "Vertical Mode");
        chkVertMode.value = false;
        chkVertMode.onClick = function () { triggerLivePreview(); };
        var ctrlPauseDur = addSliderRow(grpEasy, "Pause Dur (s):", 0.1, 10.0, DEFAULT_EASY_PAUSE_DUR, false);
        var ctrlTransDur = addSliderRow(grpEasy, "Trans Dur (s):", 0.1, 10.0, DEFAULT_EASY_TRANS_DUR, false);

        // 5. Coverflow Group
        var grpCover = grpLayoutSpecific.add("group");
        grpCover.orientation = "column";
        grpCover.alignChildren = ["fill", "top"];
        grpCover.spacing = 2; grpCover.margins = 0; grpCover.visible = false;
        var ctrlCoverSpacing = addSliderRow(grpCover, "Card Spacing:", 10, 1000, DEFAULT_COVER_SPACING, true);
        var ctrlCoverAngle = addSliderRow(grpCover, "Tilt Angle:", -180, 180, DEFAULT_COVER_ANGLE, true);
        var ctrlCoverDepth = addSliderRow(grpCover, "Depth Offset:", 0, 1000, DEFAULT_COVER_DEPTH, true);
        var ctrlSideScale = addSliderRow(grpCover, "Side Scale (%):", 1, 200, DEFAULT_COVER_SIDE_SCALE, true);
        var ctrlActiveIndex = addSliderRow(grpCover, "Active Index:", 1, 50, DEFAULT_COVER_INDEX, false);
        var rowCoverOpts = grpCover.add("group");
        rowCoverOpts.orientation = "row";
        rowCoverOpts.alignChildren = ["left", "center"];
        var chkCoverShadow = rowCoverOpts.add("checkbox", undefined, "Enable Shadow");
        chkCoverShadow.value = true;
        chkCoverShadow.onClick = function () { triggerLivePreview(); };
        var chkCoverBlur = rowCoverOpts.add("checkbox", undefined, "Depth Blur");
        chkCoverBlur.value = false;
        chkCoverBlur.onClick = function () { triggerLivePreview(); };
        var chkCoverAnim = rowCoverOpts.add("checkbox", undefined, "Step Animation");
        chkCoverAnim.value = false;
        chkCoverAnim.onClick = function () { triggerLivePreview(); };
        var ctrlShadowDist = addSliderRow(grpCover, "Shadow Dist:", 0, 200, DEFAULT_COVER_SHADOW_DIST, true);
        var ctrlShadowSoft = addSliderRow(grpCover, "Shadow Soft:", 0, 200, DEFAULT_COVER_SHADOW_SOFT, true);
        var ctrlShadowOpac = addSliderRow(grpCover, "Shadow Opacity:", 0, 100, DEFAULT_COVER_SHADOW_OPAC, true);
        var ctrlMaxBlur_Cover = addSliderRow(grpCover, "Max Blur (px):", 0, 100, DEFAULT_COVER_MAX_BLUR, true);
        var ctrlPauseDur_Cover = addSliderRow(grpCover, "Pause Dur (s):", 0.1, 10.0, DEFAULT_EASY_PAUSE_DUR, false);
        var ctrlTransDur_Cover = addSliderRow(grpCover, "Trans Dur (s):", 0.1, 10.0, DEFAULT_EASY_TRANS_DUR, false);

        // Container Group for Common Controls (Scale, X/Y/Z Rotation, Auto Rotate)
        var grpCommonControls = pnlControls.add("group");
        grpCommonControls.orientation = "column";
        grpCommonControls.alignChildren = ["fill", "top"];
        grpCommonControls.spacing = 2;
        grpCommonControls.margins = 0;

        var ctrlScale = addSliderRow(grpCommonControls, "Scale:", MIN_SCALE, 500, DEFAULT_SCALE, true);
        var ctrlRotX = addSliderRow(grpCommonControls, "X Rotation:", -360, 360, DEFAULT_ROT_X, true);
        var ctrlRotY = addSliderRow(grpCommonControls, "Y Rotation:", -360, 360, DEFAULT_ROT_Y, true);
        var ctrlRotZ = addSliderRow(grpCommonControls, "Z Rotation:", -360, 360, DEFAULT_ROT_Z, true);

        var rowAutoRot = grpCommonControls.add("group");
        rowAutoRot.orientation = "row";
        rowAutoRot.alignChildren = ["left", "center"];
        var chkAutoRotate = rowAutoRot.add("checkbox", undefined, "Auto Rotate");
        chkAutoRotate.value = DEFAULT_AUTO_ROTATE;
        chkAutoRotate.onClick = function () { triggerLivePreview(); };

        var ctrlSpeed = addSliderRow(grpCommonControls, "Rotation Speed:", -180, 180, DEFAULT_ROT_SPEED, true);

        // Live Preview Checkbox
        var rowPreview = win.add("group");
        rowPreview.orientation = "row";
        rowPreview.alignChildren = ["left", "center"];
        var chkLivePreview = rowPreview.add("checkbox", undefined, "[✓] Live Preview");
        chkLivePreview.value = true;

        // Divider
        win.add("statictext", undefined, "--------------------------------------------------------").alignment = "center";

        // Action Buttons Group
        var grpActions = win.add("group");
        grpActions.orientation = "column";
        grpActions.alignChildren = ["fill", "top"];

        var btnCreate = grpActions.add("button", undefined, "CREATE CIRCLE");
        btnCreate.graphics.font = ScriptUI.newFont(btnCreate.graphics.font.family, "BOLD", 11);

        var rowSub = grpActions.add("group");
        rowSub.orientation = "row";
        rowSub.alignChildren = ["fill", "center"];
        var btnUpdate = rowSub.add("button", undefined, "UPDATE");
        var btnReset = rowSub.add("button", undefined, "RESET");
        var btnDelete = rowSub.add("button", undefined, "DELETE");

        // Status Bar
        win.add("statictext", undefined, "--------------------------------------------------------").alignment = "center";
        var txtStatus = win.add("statictext", undefined, "Status: Ready");
        txtStatus.graphics.font = ScriptUI.newFont(txtStatus.graphics.font.family, "REGULAR", 10);

        function refreshUIFromAE() {
            var comp = getActiveComp();
            if (!comp) return;

            var selIndex = (ddLayout.selection) ? ddLayout.selection.index : 0;
            var isCircle = (selIndex === 0);
            var isEasy = (selIndex === 1);
            var isSphere = (selIndex === 2);
            var isRing = (selIndex === 3);
            var isCover = (selIndex === 4);

            var master = isCover ? findCoverflowMaster(comp) : (isRing ? findRingMaster(comp) : (isSphere ? findSphereMaster(comp) : (isEasy ? findEasyMaster(comp) : findCircleMaster(comp))));
            if (!master) return;

            var fxGroup = getEffectsGroup(master);
            if (!fxGroup) return;

            if (isCover) {
                var eActive = fxGroup.property("C3D Active Index");
                if (eActive) {
                    var ai = getEffectValue(eActive, DEFAULT_COVER_INDEX);
                    ctrlActiveIndex.slider.value = ai; ctrlActiveIndex.edit.text = ai.toFixed(1);
                }
                var eSpC = fxGroup.property("C3D Card Spacing");
                if (eSpC) {
                    var spc = getEffectValue(eSpC, DEFAULT_COVER_SPACING);
                    ctrlCoverSpacing.slider.value = spc; ctrlCoverSpacing.edit.text = Math.round(spc).toString();
                }
                var eAngC = fxGroup.property("C3D Tilt Angle");
                if (eAngC) {
                    var ang = getEffectValue(eAngC, DEFAULT_COVER_ANGLE);
                    ctrlCoverAngle.slider.value = ang; ctrlCoverAngle.edit.text = Math.round(ang).toString();
                }
                var eDepC = fxGroup.property("C3D Depth Offset");
                if (eDepC) {
                    var dep = getEffectValue(eDepC, DEFAULT_COVER_DEPTH);
                    ctrlCoverDepth.slider.value = dep; ctrlCoverDepth.edit.text = Math.round(dep).toString();
                }
                var eSScaleC = fxGroup.property("C3D Side Scale");
                if (eSScaleC) {
                    var ssc = getEffectValue(eSScaleC, DEFAULT_COVER_SIDE_SCALE);
                    ctrlSideScale.slider.value = ssc; ctrlSideScale.edit.text = Math.round(ssc).toString();
                }
                var eShE = fxGroup.property("C3D Enable Shadow");
                if (eShE) {
                    chkCoverShadow.value = (getEffectValue(eShE, 1) === 1);
                }
                var eShD = fxGroup.property("C3D Shadow Distance");
                if (eShD) {
                    var sd = getEffectValue(eShD, DEFAULT_COVER_SHADOW_DIST);
                    ctrlShadowDist.slider.value = sd; ctrlShadowDist.edit.text = Math.round(sd).toString();
                }
                var eShS = fxGroup.property("C3D Shadow Softness");
                if (eShS) {
                    var ss = getEffectValue(eShS, DEFAULT_COVER_SHADOW_SOFT);
                    ctrlShadowSoft.slider.value = ss; ctrlShadowSoft.edit.text = Math.round(ss).toString();
                }
                var eShO = fxGroup.property("C3D Shadow Opacity");
                if (eShO) {
                    var so = getEffectValue(eShO, DEFAULT_COVER_SHADOW_OPAC);
                    ctrlShadowOpac.slider.value = so; ctrlShadowOpac.edit.text = Math.round(so).toString();
                }
                var eBlE = fxGroup.property("C3D Enable Blur");
                if (eBlE) {
                    chkCoverBlur.value = (getEffectValue(eBlE, 0) === 1);
                }
                var eBlM = fxGroup.property("C3D Max Blur");
                if (eBlM) {
                    var bm = getEffectValue(eBlM, DEFAULT_COVER_MAX_BLUR);
                    ctrlMaxBlur.slider.value = bm; ctrlMaxBlur.edit.text = Math.round(bm).toString();
                }
                var eAnE = fxGroup.property("C3D Step Animation");
                if (eAnE) {
                    chkCoverAnim.value = (getEffectValue(eAnE, 0) === 1);
                }
                var ePauseC = fxGroup.property("C3D Pause Duration");
                if (ePauseC) {
                    var pdC = getEffectValue(ePauseC, DEFAULT_EASY_PAUSE_DUR);
                    ctrlPauseDur.slider.value = pdC; ctrlPauseDur.edit.text = pdC.toFixed(1);
                }
                var eTransC = fxGroup.property("C3D Transition Duration");
                if (eTransC) {
                    var tdC = getEffectValue(eTransC, DEFAULT_EASY_TRANS_DUR);
                    ctrlTransDur.slider.value = tdC; ctrlTransDur.edit.text = tdC.toFixed(1);
                }
            } else if (isRing) {
                var eRadX = fxGroup.property("C3D Radius X");
                if (eRadX) {
                    var rxv = getEffectValue(eRadX, DEFAULT_RADIUS);
                    ctrlRadius.slider.value = rxv; ctrlRadius.edit.text = Math.round(rxv).toString();
                }
                var eRadY = fxGroup.property("C3D Radius Y");
                if (eRadY) {
                    var ryv = getEffectValue(eRadY, DEFAULT_RADIUS);
                    ctrlRadiusY.slider.value = ryv; ctrlRadiusY.edit.text = Math.round(ryv).toString();
                }
                var eSpRing = fxGroup.property("C3D Ring Spacing");
                if (eSpRing) {
                    var spr = getEffectValue(eSpRing, DEFAULT_RING_SPACING);
                    ctrlSpacing.slider.value = spr; ctrlSpacing.edit.text = Math.round(spr).toString();
                }
            } else {
                var eRadius = fxGroup.property("C3D Radius");
                if (eRadius) {
                    var r = getEffectValue(eRadius, DEFAULT_RADIUS);
                    ctrlRadius.slider.value = r; ctrlRadius.edit.text = Math.round(r).toString();
                }
            }

            var eAngle = fxGroup.property("C3D Start Angle");
            if (eAngle) {
                var a = getEffectValue(eAngle, DEFAULT_START_ANGLE);
                ctrlStartAngle.slider.value = a; ctrlStartAngle.edit.text = Math.round(a).toString();
            }

            var eScale = fxGroup.property("C3D Scale");
            if (eScale) {
                var sc = getEffectValue(eScale, DEFAULT_SCALE);
                ctrlScale.slider.value = sc; ctrlScale.edit.text = Math.round(sc).toString();
            }

            var eRotX = fxGroup.property("C3D X Rotation");
            if (eRotX) {
                var rx = getEffectValue(eRotX, DEFAULT_ROT_X);
                ctrlRotX.slider.value = rx; ctrlRotX.edit.text = Math.round(rx).toString();
            }

            var eRotY = fxGroup.property("C3D Y Rotation");
            if (eRotY) {
                var ry = getEffectValue(eRotY, DEFAULT_ROT_Y);
                ctrlRotY.slider.value = ry; ctrlRotY.edit.text = Math.round(ry).toString();
            }

            var eRotZ = fxGroup.property("C3D Z Rotation");
            if (eRotZ) {
                var rz = getEffectValue(eRotZ, DEFAULT_ROT_Z);
                ctrlRotZ.slider.value = rz; ctrlRotZ.edit.text = Math.round(rz).toString();
            }

            if (isSphere) {
                var eFaceCam = fxGroup.property("C3D Face Camera");
                if (eFaceCam) {
                    chkFaceCamera.value = (getEffectValue(eFaceCam, 1) === 1);
                }

                var eBackScaleS = fxGroup.property("C3D Back Scale");
                if (eBackScaleS) {
                    var bsS = getEffectValue(eBackScaleS, DEFAULT_SPHERE_BACK_SCALE);
                    ctrlBackScale.slider.value = bsS; ctrlBackScale.edit.text = Math.round(bsS).toString();
                }

                var eScaleExpS = fxGroup.property("C3D Scale Exponent");
                if (eScaleExpS) {
                    var seS = getEffectValue(eScaleExpS, DEFAULT_SPHERE_SCALE_EXP);
                    ctrlScaleExp.slider.value = seS; ctrlScaleExp.edit.text = seS.toFixed(1);
                }

                var eMaxBlurS = fxGroup.property("C3D Max Blur");
                if (eMaxBlurS) {
                    var mbS = getEffectValue(eMaxBlurS, DEFAULT_SPHERE_MAX_BLUR);
                    ctrlMaxBlur.slider.value = mbS; ctrlMaxBlur.edit.text = Math.round(mbS).toString();
                }
            } else if (isEasy) {
                var eBackScale = fxGroup.property("C3D Back Scale");
                if (eBackScale) {
                    var bs = getEffectValue(eBackScale, DEFAULT_EASY_BACK_SCALE);
                    ctrlBackScale.slider.value = bs; ctrlBackScale.edit.text = Math.round(bs).toString();
                }

                var eScaleExp = fxGroup.property("C3D Scale Exponent");
                if (eScaleExp) {
                    var se = getEffectValue(eScaleExp, DEFAULT_EASY_SCALE_EXP);
                    ctrlScaleExp.slider.value = se; ctrlScaleExp.edit.text = se.toFixed(1);
                }

                var eBackOpac = fxGroup.property("C3D Back Opacity");
                if (eBackOpac) {
                    var bo = getEffectValue(eBackOpac, DEFAULT_EASY_BACK_OPACITY);
                    ctrlBackOpacity.slider.value = bo; ctrlBackOpacity.edit.text = Math.round(bo).toString();
                }

                var eOpacExp = fxGroup.property("C3D Opacity Exponent");
                if (eOpacExp) {
                    var oe = getEffectValue(eOpacExp, DEFAULT_EASY_OPAC_EXP);
                    ctrlOpacExp.slider.value = oe; ctrlOpacExp.edit.text = oe.toFixed(1);
                }

                var eAnim = fxGroup.property("C3D Animated");
                if (eAnim) {
                    chkAnimated.value = (getEffectValue(eAnim, 0) === 1);
                }

                var ePause = fxGroup.property("C3D Pause Duration");
                if (ePause) {
                    var pd = getEffectValue(ePause, DEFAULT_EASY_PAUSE_DUR);
                    ctrlPauseDur.slider.value = pd; ctrlPauseDur.edit.text = pd.toFixed(1);
                }

                var eTrans = fxGroup.property("C3D Transition Duration");
                if (eTrans) {
                    var td = getEffectValue(eTrans, DEFAULT_EASY_TRANS_DUR);
                    ctrlTransDur.slider.value = td; ctrlTransDur.edit.text = td.toFixed(1);
                }

                var eVert = fxGroup.property("C3D Vertical Mode");
                if (eVert) {
                    chkVertMode.value = (getEffectValue(eVert, 0) === 1);
                }
            } else if (isCircle) {
                var eSpacing = fxGroup.property("C3D Spacing");
                if (eSpacing) {
                    var sp = getEffectValue(eSpacing, DEFAULT_CIRCLE_SPACING);
                    ctrlSpacing.slider.value = sp; ctrlSpacing.edit.text = Math.round(sp).toString();
                }
            }

            var eAutoRot = fxGroup.property("C3D Auto Rotate");
            if (eAutoRot) {
                chkAutoRotate.value = (getEffectValue(eAutoRot, 0) === 1);
            }

            var eSpeed = fxGroup.property("C3D Rotation Speed");
            if (eSpeed) {
                var spd = getEffectValue(eSpeed, DEFAULT_ROT_SPEED);
                ctrlSpeed.slider.value = spd; ctrlSpeed.edit.text = Math.round(spd).toString();
            }
        }

        // DEDICATED LAYOUT LOADING FUNCTION FOR TAB SWITCHING
        function loadLayoutUI() {
            var wasUpdating = isUpdating;
            isUpdating = true; // Lock live preview during UI loading!

            var comp = getActiveComp();
            var selIndex = (ddLayout.selection) ? ddLayout.selection.index : 0;
            var isCircle = (selIndex === 0);
            var isEasy = (selIndex === 1);
            var isSphere = (selIndex === 2);
            var isRing = (selIndex === 3);
            var isCover = (selIndex === 4);

            var master = comp ? (isCover ? findCoverflowMaster(comp) : (isRing ? findRingMaster(comp) : (isSphere ? findSphereMaster(comp) : (isEasy ? findEasyMaster(comp) : findCircleMaster(comp))))) : null;

            grpCircle.visible = isCircle;
            grpRing.visible = isRing;
            grpSphere.visible = isSphere;
            grpEasy.visible = isEasy;
            grpCover.visible = isCover;

            rowAutoRot.visible = !isRing && !isCover;
            ctrlSpeed.row.visible = !isRing && !isCover;

            btnCreate.text = isCover ? "CREATE COVERFLOW" : (isRing ? "CREATE RING" : (isSphere ? "CREATE SPHERE" : (isEasy ? "CREATE EASY 3D" : "CREATE CIRCLE")));

            if (master) {
                refreshUIFromAE();
            } else {
                // Master does NOT exist in comp -> Load defaults for active layout ONLY
                ctrlScale.slider.value = DEFAULT_SCALE; ctrlScale.edit.text = DEFAULT_SCALE.toString();
                ctrlRotX.slider.value = DEFAULT_ROT_X; ctrlRotX.edit.text = DEFAULT_ROT_X.toString();
                ctrlRotY.slider.value = DEFAULT_ROT_Y; ctrlRotY.edit.text = DEFAULT_ROT_Y.toString();
                ctrlRotZ.slider.value = DEFAULT_ROT_Z; ctrlRotZ.edit.text = DEFAULT_ROT_Z.toString();
                chkAutoRotate.value = DEFAULT_AUTO_ROTATE;
                ctrlSpeed.slider.value = DEFAULT_ROT_SPEED; ctrlSpeed.edit.text = DEFAULT_ROT_SPEED.toString();

                if (isCover) {
                    ctrlCoverSpacing.slider.value = DEFAULT_COVER_SPACING; ctrlCoverSpacing.edit.text = DEFAULT_COVER_SPACING.toString();
                    ctrlCoverAngle.slider.value = DEFAULT_COVER_ANGLE; ctrlCoverAngle.edit.text = DEFAULT_COVER_ANGLE.toString();
                    ctrlCoverDepth.slider.value = DEFAULT_COVER_DEPTH; ctrlCoverDepth.edit.text = DEFAULT_COVER_DEPTH.toString();
                    ctrlSideScale.slider.value = DEFAULT_COVER_SIDE_SCALE; ctrlSideScale.edit.text = DEFAULT_COVER_SIDE_SCALE.toString();
                    ctrlActiveIndex.slider.value = DEFAULT_COVER_INDEX; ctrlActiveIndex.edit.text = DEFAULT_COVER_INDEX.toString();
                    chkCoverShadow.value = true;
                    ctrlShadowDist.slider.value = DEFAULT_COVER_SHADOW_DIST; ctrlShadowDist.edit.text = DEFAULT_COVER_SHADOW_DIST.toString();
                    ctrlShadowSoft.slider.value = DEFAULT_COVER_SHADOW_SOFT; ctrlShadowSoft.edit.text = DEFAULT_COVER_SHADOW_SOFT.toString();
                    ctrlShadowOpac.slider.value = DEFAULT_COVER_SHADOW_OPAC; ctrlShadowOpac.edit.text = DEFAULT_COVER_SHADOW_OPAC.toString();
                    chkCoverBlur.value = false;
                    ctrlMaxBlur_Cover.slider.value = DEFAULT_COVER_MAX_BLUR; ctrlMaxBlur_Cover.edit.text = DEFAULT_COVER_MAX_BLUR.toString();
                    chkCoverAnim.value = false;
                    ctrlPauseDur_Cover.slider.value = DEFAULT_EASY_PAUSE_DUR; ctrlPauseDur_Cover.edit.text = DEFAULT_EASY_PAUSE_DUR.toFixed(1);
                    ctrlTransDur_Cover.slider.value = DEFAULT_EASY_TRANS_DUR; ctrlTransDur_Cover.edit.text = DEFAULT_EASY_TRANS_DUR.toFixed(1);
                } else if (isRing) {
                    ctrlRadius_Ring.slider.value = DEFAULT_RADIUS; ctrlRadius_Ring.edit.text = DEFAULT_RADIUS.toString();
                    ctrlRadiusY.slider.value = DEFAULT_RADIUS; ctrlRadiusY.edit.text = DEFAULT_RADIUS.toString();
                    ctrlStartAngle_Ring.slider.value = DEFAULT_START_ANGLE; ctrlStartAngle_Ring.edit.text = DEFAULT_START_ANGLE.toString();
                    ctrlRingSpacing.slider.value = DEFAULT_RING_SPACING; ctrlRingSpacing.edit.text = DEFAULT_RING_SPACING.toString();
                } else if (isSphere) {
                    ctrlRadius_Sphere.slider.value = DEFAULT_RADIUS; ctrlRadius_Sphere.edit.text = DEFAULT_RADIUS.toString();
                    ctrlStartAngle_Sphere.slider.value = DEFAULT_START_ANGLE; ctrlStartAngle_Sphere.edit.text = DEFAULT_START_ANGLE.toString();
                    chkFaceCamera.value = true;
                    ctrlBackScale_Sphere.slider.value = DEFAULT_SPHERE_BACK_SCALE; ctrlBackScale_Sphere.edit.text = DEFAULT_SPHERE_BACK_SCALE.toString();
                    ctrlScaleExp_Sphere.slider.value = DEFAULT_SPHERE_SCALE_EXP; ctrlScaleExp_Sphere.edit.text = DEFAULT_SPHERE_SCALE_EXP.toFixed(1);
                    ctrlMaxBlur_Sphere.slider.value = DEFAULT_SPHERE_MAX_BLUR; ctrlMaxBlur_Sphere.edit.text = DEFAULT_SPHERE_MAX_BLUR.toString();
                } else if (isEasy) {
                    ctrlRadius_Easy.slider.value = DEFAULT_RADIUS; ctrlRadius_Easy.edit.text = DEFAULT_RADIUS.toString();
                    ctrlStartAngle_Easy.slider.value = DEFAULT_START_ANGLE; ctrlStartAngle_Easy.edit.text = DEFAULT_START_ANGLE.toString();
                    ctrlBackScale.slider.value = DEFAULT_EASY_BACK_SCALE; ctrlBackScale.edit.text = DEFAULT_EASY_BACK_SCALE.toString();
                    ctrlScaleExp.slider.value = DEFAULT_EASY_SCALE_EXP; ctrlScaleExp.edit.text = DEFAULT_EASY_SCALE_EXP.toFixed(1);
                    ctrlBackOpacity.slider.value = DEFAULT_EASY_BACK_OPACITY; ctrlBackOpacity.edit.text = DEFAULT_EASY_BACK_OPACITY.toString();
                    ctrlOpacExp.slider.value = DEFAULT_EASY_OPAC_EXP; ctrlOpacExp.edit.text = DEFAULT_EASY_OPAC_EXP.toFixed(1);
                    chkAnimated.value = false;
                    chkVertMode.value = false;
                    ctrlPauseDur.slider.value = DEFAULT_EASY_PAUSE_DUR; ctrlPauseDur.edit.text = DEFAULT_EASY_PAUSE_DUR.toFixed(1);
                    ctrlTransDur.slider.value = DEFAULT_EASY_TRANS_DUR; ctrlTransDur.edit.text = DEFAULT_EASY_TRANS_DUR.toFixed(1);
                } else {
                    ctrlRadius.slider.value = DEFAULT_RADIUS; ctrlRadius.edit.text = DEFAULT_RADIUS.toString();
                    ctrlStartAngle.slider.value = DEFAULT_START_ANGLE; ctrlStartAngle.edit.text = DEFAULT_START_ANGLE.toString();
                    ctrlSpacing.slider.value = DEFAULT_CIRCLE_SPACING; ctrlSpacing.edit.text = DEFAULT_CIRCLE_SPACING.toString();
                }
            }

            win.layout.layout(true);
            win.layout.resize();

            if (win instanceof Window) {
                win.maximumSize.height = win.preferredSize.height;
                win.size = [win.size.width, win.preferredSize.height];
            }

            isUpdating = wasUpdating;
        }

        // Layout Dropdown Switch Handler
        ddLayout.onChange = function () {
            loadLayoutUI();
        };

        function getParamsFromUI() {
            var selIndex = (ddLayout.selection) ? ddLayout.selection.index : 0;
            var isCircle = (selIndex === 0);
            var isEasy = (selIndex === 1);
            var isSphere = (selIndex === 2);
            var isRing = (selIndex === 3);
            var isCover = (selIndex === 4);

            var radCtrl = getActiveRadiusCtrl();
            var saCtrl = getActiveStartAngleCtrl();
            var bsCtrl = getActiveBackScaleCtrl();
            var seCtrl = getActiveScaleExpCtrl();
            var blurCtrl = getActiveMaxBlurCtrl();
            var pdCtrl = getActivePauseDurCtrl();
            var tdCtrl = getActiveTransDurCtrl();

            var defaultBS = isSphere ? DEFAULT_SPHERE_BACK_SCALE : DEFAULT_EASY_BACK_SCALE;
            var defaultSE = isSphere ? DEFAULT_SPHERE_SCALE_EXP : DEFAULT_EASY_SCALE_EXP;
            var defaultSpacing = isRing ? DEFAULT_RING_SPACING : DEFAULT_CIRCLE_SPACING;
            var defaultMaxBlur = isCover ? DEFAULT_COVER_MAX_BLUR : DEFAULT_SPHERE_MAX_BLUR;

            return {
                radius: safeNumber(radCtrl ? radCtrl.edit.text : DEFAULT_RADIUS, DEFAULT_RADIUS, MIN_RADIUS),
                radiusX: safeNumber(ctrlRadius_Ring ? ctrlRadius_Ring.edit.text : DEFAULT_RADIUS, DEFAULT_RADIUS, MIN_RADIUS),
                radiusY: safeNumber(ctrlRadiusY ? ctrlRadiusY.edit.text : DEFAULT_RADIUS, DEFAULT_RADIUS, MIN_RADIUS),
                startAngle: safeNumber(saCtrl ? saCtrl.edit.text : DEFAULT_START_ANGLE, DEFAULT_START_ANGLE),
                spacing: safeNumber(isRing ? ctrlRingSpacing.edit.text : ctrlSpacing.edit.text, defaultSpacing, 10, 720),
                coverSpacing: safeNumber(ctrlCoverSpacing.edit.text, DEFAULT_COVER_SPACING, 10, 1000),
                coverAngle: safeNumber(ctrlCoverAngle.edit.text, DEFAULT_COVER_ANGLE, -180, 180),
                coverDepth: safeNumber(ctrlCoverDepth.edit.text, DEFAULT_COVER_DEPTH, 0, 1000),
                sideScale: safeNumber(ctrlSideScale.edit.text, DEFAULT_COVER_SIDE_SCALE, 1, 200),
                activeIndex: safeNumber(ctrlActiveIndex.edit.text, DEFAULT_COVER_INDEX, 1, 100),
                enableShadow: chkCoverShadow.value === true,
                shadowDist: safeNumber(ctrlShadowDist.edit.text, DEFAULT_COVER_SHADOW_DIST, 0, 200),
                shadowSoft: safeNumber(ctrlShadowSoft.edit.text, DEFAULT_COVER_SHADOW_SOFT, 0, 200),
                shadowOpac: safeNumber(ctrlShadowOpac.edit.text, DEFAULT_COVER_SHADOW_OPAC, 0, 100),
                enableBlur: chkCoverBlur.value === true,
                maxBlur: safeNumber(blurCtrl ? blurCtrl.edit.text : defaultMaxBlur, defaultMaxBlur, 0, 100),
                scale: safeNumber(ctrlScale.edit.text, DEFAULT_SCALE, MIN_SCALE),
                backScale: safeNumber(bsCtrl ? bsCtrl.edit.text : defaultBS, defaultBS, 0, 100),
                scaleExp: safeNumber(seCtrl ? seCtrl.edit.text : defaultSE, defaultSE, 0.1, 5.0),
                backOpac: safeNumber(ctrlBackOpacity.edit.text, DEFAULT_EASY_BACK_OPACITY, 0, 100),
                opacExp: safeNumber(ctrlOpacExp.edit.text, DEFAULT_EASY_OPAC_EXP, 0.1, 5.0),
                isAnim: isCover ? (chkCoverAnim.value === true) : (chkAnimated.value === true),
                pauseDur: safeNumber(pdCtrl ? pdCtrl.edit.text : DEFAULT_EASY_PAUSE_DUR, DEFAULT_EASY_PAUSE_DUR, 0.1, 10.0),
                transDur: safeNumber(tdCtrl ? tdCtrl.edit.text : DEFAULT_EASY_TRANS_DUR, DEFAULT_EASY_TRANS_DUR, 0.1, 10.0),
                isVertMode: chkVertMode.value === true,
                faceCamera: chkFaceCamera.value === true,
                rotX: safeNumber(ctrlRotX.edit.text, DEFAULT_ROT_X),
                rotY: safeNumber(ctrlRotY.edit.text, DEFAULT_ROT_Y),
                rotZ: safeNumber(ctrlRotZ.edit.text, DEFAULT_ROT_Z),
                autoRotate: chkAutoRotate.value === true,
                rotSpeed: safeNumber(ctrlSpeed.edit.text, DEFAULT_ROT_SPEED)
            };
        }

        function triggerLivePreview() {
            if (!chkLivePreview.value || isUpdating) return;
            isUpdating = true;
            try {
                var comp = getActiveComp();
                var selIndex = (ddLayout.selection) ? ddLayout.selection.index : 0;
                var isCover = (selIndex === 4);
                var isRing = (selIndex === 3);
                var isSphere = (selIndex === 2);
                var isEasy = (selIndex === 1);

                if (comp) {
                    if (isCover && findCoverflowMaster(comp)) {
                        updateCoverflowCarousel(getParamsFromUI());
                        txtStatus.text = "Status: Carousel Updated";
                    } else if (isRing && findRingMaster(comp)) {
                        updateRingCarousel(getParamsFromUI());
                        txtStatus.text = "Status: Carousel Updated";
                    } else if (isSphere && findSphereMaster(comp)) {
                        updateSphereCarousel(getParamsFromUI());
                        txtStatus.text = "Status: Carousel Updated";
                    } else if (isEasy && findEasyMaster(comp)) {
                        updateEasyCarousel(getParamsFromUI());
                        txtStatus.text = "Status: Carousel Updated";
                    } else if (!isEasy && !isSphere && !isRing && !isCover && findCircleMaster(comp)) {
                        updateCircleCarousel(getParamsFromUI());
                        txtStatus.text = "Status: Carousel Updated";
                    }
                }
            } catch (e) {
                // Prevent error alerts during live preview
            }
            isUpdating = false;
        }

        btnCreate.onClick = function () {
            if (isUpdating) return;
            isUpdating = true;
            var selIndex = (ddLayout.selection) ? ddLayout.selection.index : 0;
            var isCover = (selIndex === 4);
            var isRing = (selIndex === 3);
            var isSphere = (selIndex === 2);
            var isEasy = (selIndex === 1);
            var layoutName = isCover ? "Coverflow" : (isRing ? "Ring" : (isSphere ? "3D Sphere" : (isEasy ? "Easy 3D" : "Circle")));

            txtStatus.text = "Status: Creating " + layoutName + " Carousel...";
            var success = isCover ? createCoverflowCarousel(getParamsFromUI()) : (isRing ? createRingCarousel(getParamsFromUI()) : (isSphere ? createSphereCarousel(getParamsFromUI()) : (isEasy ? createEasyCarousel(getParamsFromUI()) : createCircleCarousel(getParamsFromUI()))));
            if (success) {
                txtStatus.text = "Status: " + layoutName + " Carousel Created";
                refreshUIFromAE();
            } else {
                txtStatus.text = "Status: Create Failed";
            }
            isUpdating = false;
        };

        btnUpdate.onClick = function () {
            if (isUpdating) return;
            isUpdating = true;
            var selIndex = (ddLayout.selection) ? ddLayout.selection.index : 0;
            var isCover = (selIndex === 4);
            var isRing = (selIndex === 3);
            var isSphere = (selIndex === 2);
            var isEasy = (selIndex === 1);
            var layoutName = isCover ? "Coverflow" : (isRing ? "Ring" : (isSphere ? "3D Sphere" : (isEasy ? "Easy 3D" : "Circle")));

            txtStatus.text = "Status: Updating " + layoutName + " Carousel...";
            var uiParams = getParamsFromUI();
            var success = isCover ? updateCoverflowCarousel(uiParams) : (isRing ? updateRingCarousel(uiParams) : (isSphere ? updateSphereCarousel(uiParams) : (isEasy ? updateEasyCarousel(uiParams) : updateCircleCarousel(uiParams))));
            if (success) {
                txtStatus.text = "Status: " + layoutName + " Carousel Updated";
                refreshUIFromAE();
            } else {
                txtStatus.text = "Status: Update Failed";
            }
            isUpdating = false;
        };

        btnReset.onClick = function () {
            if (isUpdating) return;
            isUpdating = true;
            var selIndex = (ddLayout.selection) ? ddLayout.selection.index : 0;
            var isCover = (selIndex === 4);
            var isRing = (selIndex === 3);
            var isSphere = (selIndex === 2);
            var isEasy = (selIndex === 1);
            var layoutName = isCover ? "Coverflow" : (isRing ? "Ring" : (isSphere ? "3D Sphere" : (isEasy ? "Easy 3D" : "Circle")));

            txtStatus.text = "Status: Resetting " + layoutName + " Carousel...";

            // Reset UI Values for active layout ONLY
            ctrlScale.slider.value = DEFAULT_SCALE; ctrlScale.edit.text = DEFAULT_SCALE.toString();
            ctrlRotX.slider.value = DEFAULT_ROT_X; ctrlRotX.edit.text = DEFAULT_ROT_X.toString();
            ctrlRotY.slider.value = DEFAULT_ROT_Y; ctrlRotY.edit.text = DEFAULT_ROT_Y.toString();
            ctrlRotZ.slider.value = DEFAULT_ROT_Z; ctrlRotZ.edit.text = DEFAULT_ROT_Z.toString();
            chkAutoRotate.value = DEFAULT_AUTO_ROTATE;
            ctrlSpeed.slider.value = DEFAULT_ROT_SPEED; ctrlSpeed.edit.text = DEFAULT_ROT_SPEED.toString();

            if (isCover) {
                ctrlCoverSpacing.slider.value = DEFAULT_COVER_SPACING; ctrlCoverSpacing.edit.text = DEFAULT_COVER_SPACING.toString();
                ctrlCoverAngle.slider.value = DEFAULT_COVER_ANGLE; ctrlCoverAngle.edit.text = DEFAULT_COVER_ANGLE.toString();
                ctrlCoverDepth.slider.value = DEFAULT_COVER_DEPTH; ctrlCoverDepth.edit.text = DEFAULT_COVER_DEPTH.toString();
                ctrlSideScale.slider.value = DEFAULT_COVER_SIDE_SCALE; ctrlSideScale.edit.text = DEFAULT_COVER_SIDE_SCALE.toString();
                ctrlActiveIndex.slider.value = DEFAULT_COVER_INDEX; ctrlActiveIndex.edit.text = DEFAULT_COVER_INDEX.toString();
                chkCoverShadow.value = true;
                ctrlShadowDist.slider.value = DEFAULT_COVER_SHADOW_DIST; ctrlShadowDist.edit.text = DEFAULT_COVER_SHADOW_DIST.toString();
                ctrlShadowSoft.slider.value = DEFAULT_COVER_SHADOW_SOFT; ctrlShadowSoft.edit.text = DEFAULT_COVER_SHADOW_SOFT.toString();
                ctrlShadowOpac.slider.value = DEFAULT_COVER_SHADOW_OPAC; ctrlShadowOpac.edit.text = DEFAULT_COVER_SHADOW_OPAC.toString();
                chkCoverBlur.value = false;
                ctrlMaxBlur_Cover.slider.value = DEFAULT_COVER_MAX_BLUR; ctrlMaxBlur_Cover.edit.text = DEFAULT_COVER_MAX_BLUR.toString();
                chkCoverAnim.value = false;
                ctrlPauseDur_Cover.slider.value = DEFAULT_EASY_PAUSE_DUR; ctrlPauseDur_Cover.edit.text = DEFAULT_EASY_PAUSE_DUR.toFixed(1);
                ctrlTransDur_Cover.slider.value = DEFAULT_EASY_TRANS_DUR; ctrlTransDur_Cover.edit.text = DEFAULT_EASY_TRANS_DUR.toFixed(1);
                resetCoverflowCarousel();
            } else if (isRing) {
                ctrlRadius_Ring.slider.value = DEFAULT_RADIUS; ctrlRadius_Ring.edit.text = DEFAULT_RADIUS.toString();
                ctrlRadiusY.slider.value = DEFAULT_RADIUS; ctrlRadiusY.edit.text = DEFAULT_RADIUS.toString();
                ctrlStartAngle_Ring.slider.value = DEFAULT_START_ANGLE; ctrlStartAngle_Ring.edit.text = DEFAULT_START_ANGLE.toString();
                ctrlRingSpacing.slider.value = DEFAULT_RING_SPACING; ctrlRingSpacing.edit.text = DEFAULT_RING_SPACING.toString();
                resetRingCarousel();
            } else if (isSphere) {
                ctrlRadius_Sphere.slider.value = DEFAULT_RADIUS; ctrlRadius_Sphere.edit.text = DEFAULT_RADIUS.toString();
                ctrlStartAngle_Sphere.slider.value = DEFAULT_START_ANGLE; ctrlStartAngle_Sphere.edit.text = DEFAULT_START_ANGLE.toString();
                chkFaceCamera.value = true;
                ctrlBackScale_Sphere.slider.value = DEFAULT_SPHERE_BACK_SCALE; ctrlBackScale_Sphere.edit.text = DEFAULT_SPHERE_BACK_SCALE.toString();
                ctrlScaleExp_Sphere.slider.value = DEFAULT_SPHERE_SCALE_EXP; ctrlScaleExp_Sphere.edit.text = DEFAULT_SPHERE_SCALE_EXP.toFixed(1);
                ctrlMaxBlur_Sphere.slider.value = DEFAULT_SPHERE_MAX_BLUR; ctrlMaxBlur_Sphere.edit.text = DEFAULT_SPHERE_MAX_BLUR.toString();
                resetSphereCarousel();
            } else if (isEasy) {
                ctrlRadius_Easy.slider.value = DEFAULT_RADIUS; ctrlRadius_Easy.edit.text = DEFAULT_RADIUS.toString();
                ctrlStartAngle_Easy.slider.value = DEFAULT_START_ANGLE; ctrlStartAngle_Easy.edit.text = DEFAULT_START_ANGLE.toString();
                ctrlBackScale.slider.value = DEFAULT_EASY_BACK_SCALE; ctrlBackScale.edit.text = DEFAULT_EASY_BACK_SCALE.toString();
                ctrlScaleExp.slider.value = DEFAULT_EASY_SCALE_EXP; ctrlScaleExp.edit.text = DEFAULT_EASY_SCALE_EXP.toFixed(1);
                ctrlBackOpacity.slider.value = DEFAULT_EASY_BACK_OPACITY; ctrlBackOpacity.edit.text = DEFAULT_EASY_BACK_OPACITY.toString();
                ctrlOpacExp.slider.value = DEFAULT_EASY_OPAC_EXP; ctrlOpacExp.edit.text = DEFAULT_EASY_OPAC_EXP.toFixed(1);
                chkAnimated.value = false;
                chkVertMode.value = false;
                ctrlPauseDur.slider.value = DEFAULT_EASY_PAUSE_DUR; ctrlPauseDur.edit.text = DEFAULT_EASY_PAUSE_DUR.toFixed(1);
                ctrlTransDur.slider.value = DEFAULT_EASY_TRANS_DUR; ctrlTransDur.edit.text = DEFAULT_EASY_TRANS_DUR.toFixed(1);
                resetEasyCarousel();
            }

            refreshUIFromAE();

            txtStatus.text = "Status: " + layoutName + " Reset to Defaults";
            isUpdating = false;
        };

        btnDelete.onClick = function () {
            if (isUpdating) return;
            isUpdating = true;
            var selIndex = (ddLayout.selection) ? ddLayout.selection.index : 0;
            var isCover = (selIndex === 4);
            var isRing = (selIndex === 3);
            var isSphere = (selIndex === 2);
            var isEasy = (selIndex === 1);
            var layoutName = isCover ? "Coverflow" : (isRing ? "Ring" : (isSphere ? "3D Sphere" : (isEasy ? "Easy 3D" : "Circle")));

            txtStatus.text = "Status: Deleting " + layoutName + " Carousel...";
            var success = isCover ? deleteCoverflowCarousel() : (isRing ? deleteRingCarousel() : (isSphere ? deleteSphereCarousel() : (isEasy ? deleteEasyCarousel() : deleteCircleCarousel())));
            if (success) {
                txtStatus.text = "Status: " + layoutName + " Carousel Deleted";
            } else {
                txtStatus.text = "Status: Delete Failed";
            }
            isUpdating = false;
        };

        win.onResizing = win.onResize = function () {
            win.layout.resize();
        };

        loadLayoutUI();

        if (win instanceof Window) {
            win.center();
            win.show();
        } else {
            win.layout.layout(true);
        }
    }

    // Expose global bridge for MotionByDk CEP Panel integration
    $._MDK_3DCAROUSEL = {
        launchUI: function () {
            try {
                buildUI(thisObj);
                return "SUCCESS";
            } catch(e) {
                return "ERROR: " + e.toString();
            }
        },
        create: function (layoutType, paramsJson) {
            try {
                _lastCarouselError = "";
                if (typeof $ !== "undefined") $._MDK_3DCAROUSEL_LAST_ERROR = "";
                var p = (typeof paramsJson === "string") ? eval("(" + paramsJson + ")") : paramsJson;
                p = p || {};
                var res = false;
                if (layoutType === "Cover" || layoutType === "Coverflow") res = createCoverflowCarousel(p);
                else if (layoutType === "Ring") res = createRingCarousel(p);
                else if (layoutType === "Sphere") res = createSphereCarousel(p);
                else if (layoutType === "Easy") res = createEasyCarousel(p);
                else res = createCircleCarousel(p);
                if (res) return "SUCCESS";
                if (_lastCarouselError) return "ERROR: " + _lastCarouselError;
                return "FAILED";
            } catch(e) {
                return "ERROR: " + e.toString();
            }
        },
        update: function (layoutType, paramsJson) {
            try {
                _lastCarouselError = "";
                if (typeof $ !== "undefined") $._MDK_3DCAROUSEL_LAST_ERROR = "";
                var p = (typeof paramsJson === "string") ? eval("(" + paramsJson + ")") : paramsJson;
                p = p || {};
                var res = false;
                if (layoutType === "Cover" || layoutType === "Coverflow") res = updateCoverflowCarousel(p);
                else if (layoutType === "Ring") res = updateRingCarousel(p);
                else if (layoutType === "Sphere") res = updateSphereCarousel(p);
                else if (layoutType === "Easy") res = updateEasyCarousel(p);
                else res = updateCircleCarousel(p);
                if (res) return "SUCCESS";
                if (_lastCarouselError) {
                    if (_lastCarouselError.indexOf("not found") !== -1) return "NO_MASTER";
                    return "ERROR: " + _lastCarouselError;
                }
                return "FAILED";
            } catch(e) {
                return "ERROR: " + e.toString();
            }
        },
        reset: function (layoutType) {
            try {
                _lastCarouselError = "";
                if (typeof $ !== "undefined") $._MDK_3DCAROUSEL_LAST_ERROR = "";
                var res = false;
                if (layoutType === "Cover" || layoutType === "Coverflow") res = resetCoverflowCarousel();
                else if (layoutType === "Ring") res = resetRingCarousel();
                else if (layoutType === "Sphere") res = resetSphereCarousel();
                else if (layoutType === "Easy") res = resetEasyCarousel();
                else res = resetCircleCarousel();
                if (res !== false) return "SUCCESS";
                if (_lastCarouselError) return "ERROR: " + _lastCarouselError;
                return "FAILED";
            } catch(e) {
                return "ERROR: " + e.toString();
            }
        },
        deleteCarousel: function (layoutType) {
            try {
                _lastCarouselError = "";
                if (typeof $ !== "undefined") $._MDK_3DCAROUSEL_LAST_ERROR = "";
                var res = false;
                if (layoutType === "Cover" || layoutType === "Coverflow") res = deleteCoverflowCarousel();
                else if (layoutType === "Ring") res = deleteRingCarousel();
                else if (layoutType === "Sphere") res = deleteSphereCarousel();
                else if (layoutType === "Easy") res = deleteEasyCarousel();
                else res = deleteCircleCarousel();
                if (res) return "SUCCESS";
                if (_lastCarouselError) return "ERROR: " + _lastCarouselError;
                return "FAILED";
            } catch(e) {
                return "ERROR: " + e.toString();
            }
        }
    };

    if (!$._MDK_3DCAROUSEL_NO_AUTO_SHOW) {
        buildUI(thisObj);
    }

})(this);
