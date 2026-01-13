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
exports.ScrapeJob = void 0;
const typeorm_1 = require("typeorm");
let ScrapeJob = (() => {
    let _classDecorators = [(0, typeorm_1.Entity)('scrape_job')];
    let _classDescriptor;
    let _classExtraInitializers = [];
    let _classThis;
    let _id_decorators;
    let _id_initializers = [];
    let _id_extraInitializers = [];
    let _target_url_decorators;
    let _target_url_initializers = [];
    let _target_url_extraInitializers = [];
    let _target_type_decorators;
    let _target_type_initializers = [];
    let _target_type_extraInitializers = [];
    let _status_decorators;
    let _status_initializers = [];
    let _status_extraInitializers = [];
    let _started_at_decorators;
    let _started_at_initializers = [];
    let _started_at_extraInitializers = [];
    let _finished_at_decorators;
    let _finished_at_initializers = [];
    let _finished_at_extraInitializers = [];
    let _error_log_decorators;
    let _error_log_initializers = [];
    let _error_log_extraInitializers = [];
    let _result_count_decorators;
    let _result_count_initializers = [];
    let _result_count_extraInitializers = [];
    let _priority_decorators;
    let _priority_initializers = [];
    let _priority_extraInitializers = [];
    var ScrapeJob = _classThis = class {
        constructor() {
            this.id = __runInitializers(this, _id_initializers, void 0);
            this.target_url = (__runInitializers(this, _id_extraInitializers), __runInitializers(this, _target_url_initializers, void 0));
            this.target_type = (__runInitializers(this, _target_url_extraInitializers), __runInitializers(this, _target_type_initializers, void 0)); // 'navigation', 'category', 'product', 'product_detail'
            this.status = (__runInitializers(this, _target_type_extraInitializers), __runInitializers(this, _status_initializers, void 0)); // 'pending', 'processing', 'completed', 'failed'
            this.started_at = (__runInitializers(this, _status_extraInitializers), __runInitializers(this, _started_at_initializers, void 0));
            this.finished_at = (__runInitializers(this, _started_at_extraInitializers), __runInitializers(this, _finished_at_initializers, void 0));
            this.error_log = (__runInitializers(this, _finished_at_extraInitializers), __runInitializers(this, _error_log_initializers, void 0));
            this.result_count = (__runInitializers(this, _error_log_extraInitializers), __runInitializers(this, _result_count_initializers, void 0));
            this.priority = (__runInitializers(this, _result_count_extraInitializers), __runInitializers(this, _priority_initializers, void 0));
            __runInitializers(this, _priority_extraInitializers);
        }
    };
    __setFunctionName(_classThis, "ScrapeJob");
    (() => {
        const _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create(null) : void 0;
        _id_decorators = [(0, typeorm_1.PrimaryGeneratedColumn)()];
        _target_url_decorators = [(0, typeorm_1.Column)()];
        _target_type_decorators = [(0, typeorm_1.Column)()];
        _status_decorators = [(0, typeorm_1.Column)()];
        _started_at_decorators = [(0, typeorm_1.Column)({ type: 'timestamp', nullable: true })];
        _finished_at_decorators = [(0, typeorm_1.Column)({ type: 'timestamp', nullable: true })];
        _error_log_decorators = [(0, typeorm_1.Column)({ type: 'text', nullable: true })];
        _result_count_decorators = [(0, typeorm_1.Column)({ nullable: true })];
        _priority_decorators = [(0, typeorm_1.Column)({ default: 'medium' })];
        __esDecorate(null, null, _id_decorators, { kind: "field", name: "id", static: false, private: false, access: { has: obj => "id" in obj, get: obj => obj.id, set: (obj, value) => { obj.id = value; } }, metadata: _metadata }, _id_initializers, _id_extraInitializers);
        __esDecorate(null, null, _target_url_decorators, { kind: "field", name: "target_url", static: false, private: false, access: { has: obj => "target_url" in obj, get: obj => obj.target_url, set: (obj, value) => { obj.target_url = value; } }, metadata: _metadata }, _target_url_initializers, _target_url_extraInitializers);
        __esDecorate(null, null, _target_type_decorators, { kind: "field", name: "target_type", static: false, private: false, access: { has: obj => "target_type" in obj, get: obj => obj.target_type, set: (obj, value) => { obj.target_type = value; } }, metadata: _metadata }, _target_type_initializers, _target_type_extraInitializers);
        __esDecorate(null, null, _status_decorators, { kind: "field", name: "status", static: false, private: false, access: { has: obj => "status" in obj, get: obj => obj.status, set: (obj, value) => { obj.status = value; } }, metadata: _metadata }, _status_initializers, _status_extraInitializers);
        __esDecorate(null, null, _started_at_decorators, { kind: "field", name: "started_at", static: false, private: false, access: { has: obj => "started_at" in obj, get: obj => obj.started_at, set: (obj, value) => { obj.started_at = value; } }, metadata: _metadata }, _started_at_initializers, _started_at_extraInitializers);
        __esDecorate(null, null, _finished_at_decorators, { kind: "field", name: "finished_at", static: false, private: false, access: { has: obj => "finished_at" in obj, get: obj => obj.finished_at, set: (obj, value) => { obj.finished_at = value; } }, metadata: _metadata }, _finished_at_initializers, _finished_at_extraInitializers);
        __esDecorate(null, null, _error_log_decorators, { kind: "field", name: "error_log", static: false, private: false, access: { has: obj => "error_log" in obj, get: obj => obj.error_log, set: (obj, value) => { obj.error_log = value; } }, metadata: _metadata }, _error_log_initializers, _error_log_extraInitializers);
        __esDecorate(null, null, _result_count_decorators, { kind: "field", name: "result_count", static: false, private: false, access: { has: obj => "result_count" in obj, get: obj => obj.result_count, set: (obj, value) => { obj.result_count = value; } }, metadata: _metadata }, _result_count_initializers, _result_count_extraInitializers);
        __esDecorate(null, null, _priority_decorators, { kind: "field", name: "priority", static: false, private: false, access: { has: obj => "priority" in obj, get: obj => obj.priority, set: (obj, value) => { obj.priority = value; } }, metadata: _metadata }, _priority_initializers, _priority_extraInitializers);
        __esDecorate(null, _classDescriptor = { value: _classThis }, _classDecorators, { kind: "class", name: _classThis.name, metadata: _metadata }, null, _classExtraInitializers);
        ScrapeJob = _classThis = _classDescriptor.value;
        if (_metadata) Object.defineProperty(_classThis, Symbol.metadata, { enumerable: true, configurable: true, writable: true, value: _metadata });
        __runInitializers(_classThis, _classExtraInitializers);
    })();
    return ScrapeJob = _classThis;
})();
exports.ScrapeJob = ScrapeJob;
