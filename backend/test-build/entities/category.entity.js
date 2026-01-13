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
exports.Category = void 0;
const typeorm_1 = require("typeorm");
const navigation_entity_1 = require("./navigation.entity");
const product_entity_1 = require("./product.entity");
let Category = (() => {
    let _classDecorators = [(0, typeorm_1.Entity)('category')];
    let _classDescriptor;
    let _classExtraInitializers = [];
    let _classThis;
    let _id_decorators;
    let _id_initializers = [];
    let _id_extraInitializers = [];
    let _title_decorators;
    let _title_initializers = [];
    let _title_extraInitializers = [];
    let _slug_decorators;
    let _slug_initializers = [];
    let _slug_extraInitializers = [];
    let _product_count_decorators;
    let _product_count_initializers = [];
    let _product_count_extraInitializers = [];
    let _last_scraped_at_decorators;
    let _last_scraped_at_initializers = [];
    let _last_scraped_at_extraInitializers = [];
    let _navigation_decorators;
    let _navigation_initializers = [];
    let _navigation_extraInitializers = [];
    let _parent_decorators;
    let _parent_initializers = [];
    let _parent_extraInitializers = [];
    let _children_decorators;
    let _children_initializers = [];
    let _children_extraInitializers = [];
    let _products_decorators;
    let _products_initializers = [];
    let _products_extraInitializers = [];
    var Category = _classThis = class {
        constructor() {
            this.id = __runInitializers(this, _id_initializers, void 0);
            this.title = (__runInitializers(this, _id_extraInitializers), __runInitializers(this, _title_initializers, void 0));
            this.slug = (__runInitializers(this, _title_extraInitializers), __runInitializers(this, _slug_initializers, void 0));
            this.product_count = (__runInitializers(this, _slug_extraInitializers), __runInitializers(this, _product_count_initializers, void 0));
            this.last_scraped_at = (__runInitializers(this, _product_count_extraInitializers), __runInitializers(this, _last_scraped_at_initializers, void 0));
            this.navigation = (__runInitializers(this, _last_scraped_at_extraInitializers), __runInitializers(this, _navigation_initializers, void 0));
            this.parent = (__runInitializers(this, _navigation_extraInitializers), __runInitializers(this, _parent_initializers, void 0));
            this.children = (__runInitializers(this, _parent_extraInitializers), __runInitializers(this, _children_initializers, void 0));
            this.products = (__runInitializers(this, _children_extraInitializers), __runInitializers(this, _products_initializers, void 0));
            __runInitializers(this, _products_extraInitializers);
        }
    };
    __setFunctionName(_classThis, "Category");
    (() => {
        const _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create(null) : void 0;
        _id_decorators = [(0, typeorm_1.PrimaryGeneratedColumn)()];
        _title_decorators = [(0, typeorm_1.Column)()];
        _slug_decorators = [(0, typeorm_1.Column)({ unique: true })];
        _product_count_decorators = [(0, typeorm_1.Column)({ name: 'product_count', default: 0 })];
        _last_scraped_at_decorators = [(0, typeorm_1.Column)({ name: 'last_scraped_at', type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })];
        _navigation_decorators = [(0, typeorm_1.ManyToOne)(() => navigation_entity_1.Navigation, (navigation) => navigation.categories), (0, typeorm_1.JoinColumn)({ name: 'navigation_id' })];
        _parent_decorators = [(0, typeorm_1.ManyToOne)(() => Category, (category) => category.children, { nullable: true }), (0, typeorm_1.JoinColumn)({ name: 'parent_id' })];
        _children_decorators = [(0, typeorm_1.OneToMany)(() => Category, (category) => category.parent)];
        _products_decorators = [(0, typeorm_1.OneToMany)(() => product_entity_1.Product, (product) => product.category)];
        __esDecorate(null, null, _id_decorators, { kind: "field", name: "id", static: false, private: false, access: { has: obj => "id" in obj, get: obj => obj.id, set: (obj, value) => { obj.id = value; } }, metadata: _metadata }, _id_initializers, _id_extraInitializers);
        __esDecorate(null, null, _title_decorators, { kind: "field", name: "title", static: false, private: false, access: { has: obj => "title" in obj, get: obj => obj.title, set: (obj, value) => { obj.title = value; } }, metadata: _metadata }, _title_initializers, _title_extraInitializers);
        __esDecorate(null, null, _slug_decorators, { kind: "field", name: "slug", static: false, private: false, access: { has: obj => "slug" in obj, get: obj => obj.slug, set: (obj, value) => { obj.slug = value; } }, metadata: _metadata }, _slug_initializers, _slug_extraInitializers);
        __esDecorate(null, null, _product_count_decorators, { kind: "field", name: "product_count", static: false, private: false, access: { has: obj => "product_count" in obj, get: obj => obj.product_count, set: (obj, value) => { obj.product_count = value; } }, metadata: _metadata }, _product_count_initializers, _product_count_extraInitializers);
        __esDecorate(null, null, _last_scraped_at_decorators, { kind: "field", name: "last_scraped_at", static: false, private: false, access: { has: obj => "last_scraped_at" in obj, get: obj => obj.last_scraped_at, set: (obj, value) => { obj.last_scraped_at = value; } }, metadata: _metadata }, _last_scraped_at_initializers, _last_scraped_at_extraInitializers);
        __esDecorate(null, null, _navigation_decorators, { kind: "field", name: "navigation", static: false, private: false, access: { has: obj => "navigation" in obj, get: obj => obj.navigation, set: (obj, value) => { obj.navigation = value; } }, metadata: _metadata }, _navigation_initializers, _navigation_extraInitializers);
        __esDecorate(null, null, _parent_decorators, { kind: "field", name: "parent", static: false, private: false, access: { has: obj => "parent" in obj, get: obj => obj.parent, set: (obj, value) => { obj.parent = value; } }, metadata: _metadata }, _parent_initializers, _parent_extraInitializers);
        __esDecorate(null, null, _children_decorators, { kind: "field", name: "children", static: false, private: false, access: { has: obj => "children" in obj, get: obj => obj.children, set: (obj, value) => { obj.children = value; } }, metadata: _metadata }, _children_initializers, _children_extraInitializers);
        __esDecorate(null, null, _products_decorators, { kind: "field", name: "products", static: false, private: false, access: { has: obj => "products" in obj, get: obj => obj.products, set: (obj, value) => { obj.products = value; } }, metadata: _metadata }, _products_initializers, _products_extraInitializers);
        __esDecorate(null, _classDescriptor = { value: _classThis }, _classDecorators, { kind: "class", name: _classThis.name, metadata: _metadata }, null, _classExtraInitializers);
        Category = _classThis = _classDescriptor.value;
        if (_metadata) Object.defineProperty(_classThis, Symbol.metadata, { enumerable: true, configurable: true, writable: true, value: _metadata });
        __runInitializers(_classThis, _classExtraInitializers);
    })();
    return Category = _classThis;
})();
exports.Category = Category;
