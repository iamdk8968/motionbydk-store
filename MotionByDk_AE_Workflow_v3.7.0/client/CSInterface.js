/**************************************************************************************************
*
* ADOBE SYSTEMS INCORPORATED
* Copyright 2013 Adobe Systems Incorporated
* All Rights Reserved.
*
* NOTICE:  Adobe permits you to use, modify, and distribute this file in accordance with the
* terms of the Adobe license agreement accompanying it.  If you have received this file from a
* source other than Adobe, then your use, modification, or distribution of it requires the prior
* written permission of Adobe.
*
**************************************************************************************************/

/** CSInterface - v9.2.0 */

/**
 * Stores constants for the window types supported by the CSXS infrastructure.
 */
function CSXSWindowType()
{
}

/** Constant for the CSXS window type Panel. */
CSXSWindowType.PANEL = "Panel";

/** Constant for the CSXS window type Modeless. */
CSXSWindowType.MODELESS = "Modeless";

/** Constant for the CSXS window type ModalDialog. */
CSXSWindowType.MODAL_DIALOG = "ModalDialog";

/** EvalScript error message */
EvalScript_ErrMessage = "EvalScript error.";

/**
 * @class Version
 * Represents a version numbers.
 * @param major {number} - The major version number.
 * @param minor {number} - The minor version number.
 * @param revision {number} - The revision number.
 */
function Version(major, minor, revision)
{
    this.major = major;
    this.minor = minor;
    this.revision = revision;
}

/**
 * @class VersionBound
 * Represents a minimum or maximum version bound.
 * @param {number} major - The major version number.
 * @param {number} minor {number} - The minor version number.
 * @param {number} revision {number} - The revision number.
 * @param {boolean} equal - If true, the bound is inclusive (less than or equal to / greater than or equal to).
 *                          If false, the bound is exclusive (less than / greater than).
 */
function VersionBound(major, minor, revision, equal)
{
    this.major = major;
    this.minor = minor;
    this.revision = revision;
    this.equal = equal;
}

/**
 * @class VersionRange
 * Represents a range of versions.
 * @param {VersionBound} minVersion - The minimum version that is included in the range.
 * @param {VersionBound} maxVersion - The maximum version that is included in the range.
 */
function VersionRange(minVersion, maxVersion)
{
    this.minVersion = minVersion;
    this.maxVersion = maxVersion;
}

/**
 * @class Runtime
 * Represents a runtime related to the CEP infrastructure.
 * @param {string} name - The runtime name.
 * @param {VersionRange} versionRange - The version range of the runtime.
 */
function Runtime(name, versionRange)
{
    this.name = name;
    this.versionRange = versionRange;
}

/**
 * @class Extension
 * Represents an extension.
 * @param {Array.<Runtime>} requiredRuntimes -  The array of required runtimes.
 */
function Extension(requiredRuntimes)
{
    this.requiredRuntimes = requiredRuntimes;
}

/**
 * @class CSEvent
 * General template for an event to be sent to ExtendScript.
 * @param {string} type - The name of the event type.
 * @param {string} scope - The target of the event, can be "GLOBAL" or "APPLICATION".
 * @param {string} appId - The application ID to which the event should be sent.
 * @param {string} extensionId - The extension ID to which the event should be sent.
 */
function CSEvent(type, scope, appId, extensionId)
{
    this.type = type;
    this.scope = scope;
    this.appId = appId;
    this.extensionId = extensionId;
}

/** Add a name-value pair to the data object of the event. */
CSEvent.prototype.addData = function(key, value)
{
    if (this.data === undefined)
    {
        this.data = {};
    }
    this.data[key] = value;
};

/** @private */
var csInterface = new CSInterface();

/**
 * @class CSInterface
 * Cross-platform JavaScript interface.
 */
function CSInterface()
{
    this.version = "9.2.0";
}

/**
 * User can add this event listener to handle native application theme color changes.
 * Callback function gives extensions ability to fine-tune their theme color after the
 * global theme color has been changed.
 * The callback function should be like below:
 *
 * @example
 * // event is a CSEvent object, event.data is the theme data
 * function OnAppThemeColorChanged(event)
 * {
 *    // Should get a latest HostEnvironment object from application,
 *    // since the color theme is updated.
 *    var skinInfo = JSON.parse(window.__adobe_cep__.getHostEnvironment()).appSkinInfo;
 *    var backgroundColor = skinInfo.panelBackgroundColor.color;
 *    document.body.bgColor = "rgb(" + backgroundColor.red + ", " + backgroundColor.green + ", " + backgroundColor.blue + ")";
 * }
 */
CSInterface.THEME_COLOR_CHANGED_EVENT = "com.adobe.csxs.events.ThemeColorChanged";

/** The host environment data object. */
CSInterface.prototype.hostEnvironment = window.__adobe_cep__ ? JSON.parse(window.__adobe_cep__.getHostEnvironment()) : null;

/** Retrieves the current window's outer height. */
CSInterface.prototype.getApplicationID = function()
{
    var appId = this.hostEnvironment.appId;
    return appId;
};

/** Retrieves the unique identifier of the application. */
CSInterface.prototype.getApplicationUUID = function()
{
    var appUUID = this.hostEnvironment.appUUID;
    return appUUID;
};

/**
 * Retrieves the complete path of the host application.
 * @returns {string} The complete path of the host application.
 */
CSInterface.prototype.getApplicationPath = function()
{
    var path = this.hostEnvironment.appPath;
    return path;
};

/**
 * Launches a URL in the default system browser.
 *
 * @param {string} url - The URL to launch.
 */
CSInterface.prototype.openURLInDefaultBrowser = function(url)
{
    if (cep.util !== undefined) {
        cep.util.openURLInDefaultBrowser(url);
    } else {
        window.cep.util.openURLInDefaultBrowser(url);
    }
};

/**
 * Retrieves the bounds of the application window.
 * @returns {Object} - An object with the properties top, left, bottom, right.
 */
CSInterface.prototype.getApplicationBounds = function()
{
    var bounds = this.hostEnvironment.appBounds;
    return bounds;
};

/**
 * Registers an interest in a CEP event of a particular type, and assigns an event handler.
 *
 * @param {string} type - The name of the event type of interest.
 * @param {Function} listener - The JavaScript handler function or method.
 * @param {Object} obj - The object containing the handler.
 */
CSInterface.prototype.addEventListener = function(type, listener, obj)
{
    if (obj)
    {
        window.addEventListener(type, listener.bind(obj));
    }
    else
    {
        window.addEventListener(type, listener);
    }
};

/**
 * Removes a CEP event listener.
 *
 * @param {string} type - The name of the event type of interest.
 * @param {Function} listener - The JavaScript handler function or method.
 * @param {Object} obj - The object containing the handler.
 */
CSInterface.prototype.removeEventListener = function(type, listener, obj)
{
    if (obj)
    {
        window.removeEventListener(type, listener.bind(obj));
    }
    else
    {
        window.removeEventListener(type, listener);
    }
};

/**
 * Loads and launches another extension.
 *
 * @param {string} extensionId - The extension ID to launch.
 * @param {string} startupParams - Not currently used, pass "".
 */
CSInterface.prototype.requestOpenExtension = function(extensionId, startupParams)
{
    window.__adobe_cep__.requestOpenExtension(extensionId, startupParams);
};

/**
 * Retrieves the list of extensions currently loaded in the current host application.
 * The extension list maintains the following contract:
 * 1. If extensionId is not specified, all extensions in the current host application are included.
 * 2. If extensionId is specified, only the extension with the specified ID is included.
 *
 * @param {string} extensionId - The extension ID to launch. If omitted, all extensions are loaded.
 * @returns {Array} The array of extensions currently loaded in the current host application.
 */
CSInterface.prototype.getExtensions = function(extensionId)
{
    var extensions = window.__adobe_cep__.getExtensions(extensionId);
    return extensions;
};

/**
 * Retrieves the list of all the registered extensions in the current host application.
 * The extension list maintains the following contract:
 * 1. Extension id is globally unique
 * 2. If extensionId is not specified, all extensions are included.
 * 3. If extensionId is specified, only the extension with the specified ID is included.
 *
 * @param {string} extensionId - The extension ID to register. If omitted, all extensions are returned.
 * @returns {Array} The array of all the registered extensions in the current host application.
 */
CSInterface.prototype.getApplicationExtensionList = function(extensionId)
{
    var extensionList = window.__adobe_cep__.getApplicationExtensionList(extensionId);
    return extensionList;
};

/**
 * Retrieves the system's color theme settings.
 * @returns {Object} An object representing the host app's color theme settings.
 */
CSInterface.prototype.getHostEnvironment = function()
{
    if (window.__adobe_cep__)
    {
        return JSON.parse(window.__adobe_cep__.getHostEnvironment());
    }
    else
    {
        return null;
    }
};

/**
 * Translates a path for the current operating system.
 * Specifically, this method can translate a Unix-style path to a Windows-style path.
 *
 * @param {string} path - The path to be translated.
 * @returns {string} The translated path.
 */
CSInterface.prototype.getOSPathDescriptor = function(path)
{
    return window.__adobe_cep__.getOSPathDescriptor(path);
};

/**
 * Evaluates a JavaScript script in the context of the host application.
 *
 * @param {string} script - The script to execute.
 * @param {Function} callback - Optional. A callback function that receives the result of execution.
 * @returns {string} The result of the script execution.
 */
CSInterface.prototype.evalScript = function(script, callback)
{
    if(callback === null || callback === undefined)
    {
        callback = function(result){};
    }
    window.__adobe_cep__.evalScript(script, callback);
};

/**
 * Retrieves a path for a given file.
 *
 * @param {number} pathType - The path type constant defined in CEPEngineConstants.PathType
 * @returns {string} The platform-specific path string.
 */
CSInterface.prototype.getSystemPath = function(pathType)
{
    var path = window.__adobe_cep__.getSystemPath(pathType);
    return path;
};

/**
 * Registers a JavaScript function to be called upon a CEP event.
 *
 * @param {string} type - The name of the event type of interest.
 * @param {Function} listener - The JavaScript handler function or method.
 * @param {Object} obj - The object containing the handler.
 */
CSInterface.prototype.addEventListener = function(type, listener, obj)
{
    if (obj)
    {
        window.addEventListener(type, listener.bind(obj));
    }
    else
    {
        window.addEventListener(type, listener);
    }
};

/**
 * Removes a CEP event listener.
 *
 * @param {string} type - The name of the event type of interest.
 * @param {Function} listener - The JavaScript handler function or method.
 * @param {Object} obj - The object containing the handler.
 */
CSInterface.prototype.removeEventListener = function(type, listener, obj)
{
    if (obj)
    {
        window.removeEventListener(type, listener.bind(obj));
    }
    else
    {
        window.removeEventListener(type, listener);
    }
};

/**
 * Stores a setting in the persistent file.
 *
 * @param {string} extensionId - The extension ID.
 * @param {string} settingName - The setting name.
 * @param {string} settingValue - The setting value.
 */
CSInterface.prototype.setSetting = function(extensionId, settingName, settingValue)
{
    window.__adobe_cep__.setSetting(extensionId, settingName, settingValue);
};

/**
 * Retrieves a setting from the persistent file.
 *
 * @param {string} extensionId - The extension ID.
 * @param {string} settingName - The setting name.
 * @param {Function} callback - A callback function that receives the setting value.
 */
CSInterface.prototype.getSetting = function(extensionId, settingName, callback)
{
    var setting = window.__adobe_cep__.getSetting(extensionId, settingName);
    callback(setting);
};

/**
 * Registers the JavaScript functions that extend the native application functionality through CEP.
 *
 * @param {Object} params - An object containing the following properties:
 *    {string} extensionId - The extension ID.
 *    {string} functionName - The name of the function to register.
 *    {Function} function - The function to register.
 */
CSInterface.prototype.registerExtension = function(params)
{
    window.__adobe_cep__.registerExtension(params);
};

/**
 * Loads binary content (images) from the extension's resources folder.
 * The URL should be relative to the extension's resources folder.
 *
 * @param {string} path - The relative path of the resource to load.
 * @returns {string} The data URI of the image, or an empty string if the image could not be loaded.
 */
CSInterface.prototype.getResource = function(path)
{
    return window.__adobe_cep__.getResource(path);
};

/**
 * Loads binary content (images) from the extension's resources folder synchronously.
 * The URL should be relative to the extension's resources folder.
 *
 * @param {string} path - The relative path of the resource to load.
 * @returns {string} The data URI of the image, or an empty string if the image could not be loaded.
 */
CSInterface.prototype.getResourceSync = function(path)
{
    return window.__adobe_cep__.getResourceSync(path);
};