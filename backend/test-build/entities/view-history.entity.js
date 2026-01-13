"use strict";
var __esDecorate = (this && this.__esDecorate) || function (ctor, descriptorIn, decorators, contextIn, initializers, extraInitializers) {
    function accept(f) { if (f !== void 0 && typeof f !== "function") throw new TypeError("Function expected"); return f; }
    var kind = contextIn.kind, key = kind === "getter" ? "get" : kind === "setter" ? "set" : "value";
    var target = !descriptorIn && ctor ? contextIn["static"] ? ctor : ctor.prototype : null;
    var descriptor = descriptorIn || (target ? Object.getOwnPropertyDescriptor(target, contextIn.name) : {});
    var _, done = false;
    for (var i = decorators.length - 1; i >= 0; i--) {
        var context = {};
        for (var p in contextIn) context[p] = p === "access" ? {} : contextIn[p];
        for (var p in contextIn.access) context.access[p] = contextIn.access[p];
        context.addInitializer = function (f) { if (done) throw new TypeError("Cannot add initializers after decoration has completed"); extraInitializers.push(accept(f || null)); };
        var result = (0, decorators[i])(kind === "accessor" ? { get: descriptor.get, set: descriptor.set } : descriptor[key], context);
        if (kind === "accessor") {
            if (result === void 0) continue;
            if (result === null || typeof result !== "object") throw new TypeError("Object expected");
            if (_ = accept(result.get)) descriptor.get = _;
            if (_ = accept(result.set)) descriptor.set = _;
            if (_ = accept(result.init)) initializers.unshift(_);
        }
        else if (_ = accept(result)) {
            if (kind === "field") initializers.unshift(_);
            else descriptor[key] = _;
        }
    }
    if (target) Object.defineProperty(target, contextIn.name, descriptor);
    done = true;
};
var __runInitializers = (this && this.__runInitializers) || function (thisArg, initializers, value) {
    var useValue = arguments.length > 2;
    for (var i = 0; i < initializers.length; i++) {
        value = useValue ? initializers[i].call(thisArg, value) : initializers[i].call(thisArg);
    }
    return useValue ? value : void 0;
};
var __setFunctionName = (this && this.__setFunctionName) || function (f, name, prefix) {
    if (typeof name === "symbol") name = name.description ? "[".concat(name.description, "]") : "";
    return Object.defineProperty(f, "name", { configurable: true, value: prefix ? "".concat(prefix, " ", name) : name });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ViewHistory = void 0;
const typeorm_1 = require("typeorm");
let ViewHistory = (() => {
    let _classDecorators = [(0, typeorm_1.Entity)('view_history')];
    let _classDescriptor;
    let _classExtraInitializers = [];
    let _classThis;
    let _id_decorators;
    let _id_initializers = [];
    let _id_extraInitializers = [];
    let _user_id_decorators;
    let _user_id_initializers = [];
    let _user_id_extraInitializers = [];
    let _session_id_decorators;
    let _session_id_initializers = [];
    let _session_id_extraInitializers = [];
    let _path_json_decorators;
    let _path_json_initializers = [];
    let _path_json_extraInitializers = [];
    let _created_at_decorators;
    let _created_at_initializers = [];
    let _created_at_extraInitializers = [];
    var ViewHistory = _classThis = class {
        constructor() {
            this.id = __runInitializers(this, _id_initializers, void 0);
            this.user_id = (__runInitializers(this, _id_extraInitializers), __runInitializers(this, _user_id_initializers, void 0));
            this.session_id = (__runInitializers(this, _user_id_extraInitializers), __runInitializers(this, _session_id_initializers, void 0));
            this.path_json = (__runInitializers(this, _session_id_extraInitializers), __runInitializers(this, _path_json_initializers, void 0)); // Store navigation path as JSON
            this.created_at = (__runInitializers(this, _path_json_extraInitializers), __runInitializers(this, _created_at_initializers, void 0));
            __runInitializers(this, _created_at_extraInitializers);
        }
    };
    __setFunctionName(_classThis, "ViewHistory");
    (() => {
        const _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create(null) : void 0;
        _id_decorators = [(0, typeorm_1.PrimaryGeneratedColumn)()];
        _user_id_decorators = [(0, typeorm_1.Column)({ nullable: true })];
        _session_id_decorators = [(0, typeorm_1.Column)()];
        _path_json_decorators = [(0, typeorm_1.Column)('jsonb')];
        _created_at_decorators = [(0, typeorm_1.Column)({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })];
        __esDecorate(null, null, _id_decorators, { kind: "field", name: "id", static: false, private: false, access: { has: obj => "id" in obj, get: obj => obj.id, set: (obj, value) => { obj.id = value; } }, metadata: _metadata }, _id_initializers, _id_extraInitializers);
        __esDecorate(null, null, _user_id_decorators, { kind: "field", name: "user_id", static: false, private: false, access: { has: obj => "user_id" in obj, get: obj => obj.user_id, set: (obj, value) => { obj.user_id = value; } }, metadata: _metadata }, _user_id_initializers, _user_id_extraInitializers);
        __esDecorate(null, null, _session_id_decorators, { kind: "field", name: "session_id", static: false, private: false, access: { has: obj => "session_id" in obj, get: obj => obj.session_id, set: (obj, value) => { obj.session_id = value; } }, metadata: _metadata }, _session_id_initializers, _session_id_extraInitializers);
        __esDecorate(null, null, _path_json_decorators, { kind: "field", name: "path_json", static: false, private: false, access: { has: obj => "path_json" in obj, get: obj => obj.path_json, set: (obj, value) => { obj.path_json = value; } }, metadata: _metadata }, _path_json_initializers, _path_json_extraInitializers);
        __esDecorate(null, null, _created_at_decorators, { kind: "field", name: "created_at", static: false, private: false, access: { has: obj => "created_at" in obj, get: obj => obj.created_at, set: (obj, value) => { obj.created_at = value; } }, metadata: _metadata }, _created_at_initializers, _created_at_extraInitializers);
        __esDecorate(null, _classDescriptor = { value: _classThis }, _classDecorators, { kind: "class", name: _classThis.name, metadata: _metadata }, null, _classExtraInitializers);
        ViewHistory = _classThis = _classDescriptor.value;
        if (_metadata) Object.defineProperty(_classThis, Symbol.metadata, { enumerable: true, configurable: true, writable: true, value: _metadata });
        __runInitializers(_classThis, _classExtraInitializers);
    })();
    return ViewHistory = _classThis;
})();
exports.ViewHistory = ViewHistory;
