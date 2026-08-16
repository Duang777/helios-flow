import { randomUUID } from "node:crypto";
import path from "node:path";
import { promises as fs } from "node:fs";
import type { EntityManager } from "@mikro-orm/postgresql";
import type { AwilixContainer } from "awilix";
import { SalesChannel } from "@helios/core/modules/sales/data/entities";
import {
  CatalogOffer,
  CatalogPriceKind,
  CatalogProduct,
  CatalogProductCategory,
  CatalogProductCategoryAssignment,
  CatalogProductPrice,
  CatalogProductVariant,
} from "../data/entities";
import { DefaultDataEngine } from "@helios/shared/lib/data/engine";
import {
  ensureCustomFieldDefinitions,
  type FieldSetInput,
} from "@helios/core/modules/entities/lib/field-definitions";
import { CustomFieldEntityConfig } from "@helios/core/modules/entities/data/entities";
import { rebuildCategoryHierarchyForOrganization } from "../lib/categoryHierarchy";
import { defineFields, cf } from "@helios/shared/modules/dsl";
import { E } from "#generated/entities.ids.generated";
import { SalesTaxRate } from "@helios/core/modules/sales/data/entities";
import {
  Attachment,
  AttachmentPartition,
} from "@helios/core/modules/attachments/data/entities";
import {
  ensureDefaultPartitions,
  resolveDefaultPartitionCode,
} from "@helios/core/modules/attachments/lib/partitions";
import { storePartitionFile } from "@helios/core/modules/attachments/lib/storage";
import { mergeAttachmentMetadata } from "@helios/core/modules/attachments/lib/metadata";
import {
  buildAttachmentFileUrl,
  buildAttachmentImageUrl,
  slugifyAttachmentFileName,
} from "@helios/core/modules/attachments/lib/imageUrls";
import { canonicalizeUnitCode } from "../lib/unitCodes";
import { createLogger } from '@helios/shared/lib/logger';

const logger = createLogger('catalog');

type SeedScope = { tenantId: string; organizationId: string };

const EXAMPLES_MEDIA_ROOT = path.join(process.cwd(), "public", "examples");

function detectMimeType(fileName: string): string {
  const ext = fileName.toLowerCase().split(".").pop() || "";
  if (ext === "png") return "image/png";
  if (ext === "jpg" || ext === "jpeg") return "image/jpeg";
  if (ext === "webp") return "image/webp";
  return "application/octet-stream";
}

async function ensureAttachmentPartition(
  em: EntityManager,
  code: string,
): Promise<AttachmentPartition> {
  let partition = await em.findOne(AttachmentPartition, { code });
  if (!partition) {
    await ensureDefaultPartitions(em);
    partition = await em.findOne(AttachmentPartition, { code });
  }
  if (!partition) {
    throw new Error(`Attachment partition "${code}" is not configured.`);
  }
  return partition;
}

async function attachMediaFromExamples(
  em: EntityManager,
  scope: SeedScope,
  entityId: string,
  recordId: string,
  mediaSeeds?: MediaSeed[],
): Promise<Array<{ id: string; imageUrl: string }>> {
  if (!mediaSeeds?.length) return [];
  const partitionCode = resolveDefaultPartitionCode(entityId);
  const partition = await ensureAttachmentPartition(em, partitionCode);
  const results: Array<{ id: string; imageUrl: string }> = [];
  for (const media of mediaSeeds) {
    const sourcePath = path.join(EXAMPLES_MEDIA_ROOT, media.file);
    let buffer: Buffer;
    try {
      buffer = await fs.readFile(sourcePath);
    } catch (error) {
      logger.warn('catalog.seed example media missing', { sourcePath });
      continue;
    }
    const stored = await storePartitionFile({
      partitionCode: partition.code,
      orgId: scope.organizationId,
      tenantId: scope.tenantId,
      fileName: media.file,
      buffer,
    });
    const attachmentId = randomUUID();
    const slug = slugifyAttachmentFileName(media.file, "media");
    const metadata = mergeAttachmentMetadata(null, {
      assignments: [{ type: entityId, id: recordId }],
    });
    const attachment = em.create(Attachment, {
      id: attachmentId,
      entityId,
      recordId,
      organizationId: scope.organizationId,
      tenantId: scope.tenantId,
      partitionCode: partition.code,
      fileName: media.file,
      mimeType: detectMimeType(media.file),
      fileSize: buffer.length,
      storageDriver: partition.storageDriver || "local",
      storagePath: stored.storagePath,
      storageMetadata: metadata,
      url: buildAttachmentFileUrl(attachmentId),
    });
    em.persist(attachment);
    results.push({
      id: attachmentId,
      imageUrl: buildAttachmentImageUrl(attachmentId, { slug }),
    });
  }
  return results;
}

const PRODUCT_FIELDSETS = [
  {
    code: "fashion_mens_footwear",
    label: "服饰 · 男装 · 鞋履",
    icon: "carbon:sneaker",
    description: "男士性能鞋履的材质、结构与护理信息。",
    groups: [
      { code: "identity", title: "基础信息" },
      { code: "materials", title: "材质与结构" },
      { code: "care", title: "护理说明" },
    ],
  },
  {
    code: "fashion_womens_dresses",
    label: "服饰 · 女装 · 连衣裙",
    icon: "solar:dress-linear",
    description: "女装廓形、面料与护理信息。",
    groups: [
      { code: "identity", title: "基础信息" },
      { code: "materials", title: "面料" },
      { code: "fit", title: "版型与长度" },
      { code: "care", title: "护理说明" },
    ],
  },
  {
    code: "service_schedule",
    label: "服务 · 预约排期",
    icon: "solar:calendar-linear",
    description: "服务商品的预约、准备与交付信息。",
    groups: [
      { code: "identity", title: "基础信息" },
      { code: "timing", title: "时间规则" },
      { code: "resources", title: "资源与交付" },
    ],
  },
] as const;

const VARIANT_FIELDSETS = [
  {
    code: "fashion_mens_footwear",
    label: "服饰 · 男装 · 鞋履",
    icon: "carbon:sneaker",
    description: "男士鞋履变体的尺码信息。",
    groups: [
      { code: "fit", title: "尺码" },
      { code: "finish", title: "颜色与外观" },
    ],
  },
  {
    code: "fashion_womens_dresses",
    label: "服饰 · 女装 · 连衣裙",
    icon: "solar:dress-linear",
    description: "女装变体的尺码信息。",
    groups: [
      { code: "fit", title: "尺码" },
      { code: "finish", title: "颜色与外观" },
    ],
  },
  {
    code: "service_schedule",
    label: "服务 · 预约排期",
    icon: "solar:calendar-linear",
    description: "服务时段的服务人员、时长和环境信息。",
    groups: [
      { code: "provider", title: "服务人员" },
      { code: "environment", title: "服务环境" },
    ],
  },
] as const;

const CUSTHELIOS_FIELD_SETS: FieldSetInput[] = [
  defineFields(E.catalog.catalog_product, [
    cf.text("style_code", {
      label: "款式编码",
      description: "供商品运营团队共用的款式参考码。",
      filterable: true,
      fieldset: "fashion_mens_footwear",
      group: { code: "identity" },
    }),
    cf.select(
      "upper_material",
      ["engineered_knit", "full_grain_leather", "recycled_mesh"],
      {
        label: "鞋面材质",
        fieldset: "fashion_mens_footwear",
        group: { code: "materials" },
        filterable: true,
      },
    ),
    cf.select("cushioning_profile", ["responsive", "plush", "stability"], {
      label: "缓震类型",
      fieldset: "fashion_mens_footwear",
      group: { code: "materials" },
    }),
    cf.multiline("care_notes", {
      label: "护理备注",
      editor: "markdown",
      fieldset: "fashion_mens_footwear",
      group: { code: "care" },
    }),
  ]),
  defineFields(E.catalog.catalog_product, [
    cf.select("silhouette", ["wrap", "column", "fit_and_flare", "jumpsuit"], {
      label: "廓形",
      fieldset: "fashion_womens_dresses",
      group: { code: "identity" },
      filterable: true,
    }),
    cf.select("fabric_mix", ["silk_blend", "recycled_poly", "linen", "cupro"], {
      label: "面料组合",
      fieldset: "fashion_womens_dresses",
      group: { code: "materials" },
    }),
    cf.select("occasion_ready", ["daytime", "evening", "resort"], {
      label: "适用场景",
      fieldset: "fashion_womens_dresses",
      group: { code: "fit" },
    }),
    cf.multiline("finishing_details", {
      label: "工艺细节",
      editor: "markdown",
      fieldset: "fashion_womens_dresses",
      group: { code: "care" },
    }),
  ]),
  defineFields(E.catalog.catalog_product_variant, [
    cf.integer("shoe_size", {
      label: "美码尺码",
      fieldset: "fashion_mens_footwear",
      group: { code: "fit" },
      filterable: true,
    }),
    cf.select("shoe_width", ["B", "D", "EE"], {
      label: "鞋楦宽度",
      fieldset: "fashion_mens_footwear",
      group: { code: "fit" },
    }),
    cf.text("colorway", {
      label: "配色",
      fieldset: "fashion_mens_footwear",
      group: { code: "finish" },
    }),
  ]),
  defineFields(E.catalog.catalog_product_variant, [
    cf.integer("numeric_size", {
      label: "数字尺码",
      fieldset: "fashion_womens_dresses",
      group: { code: "fit" },
    }),
    cf.select("length_profile", ["mini", "midi", "maxi"], {
      label: "裙长",
      fieldset: "fashion_womens_dresses",
      group: { code: "fit" },
    }),
    cf.text("color_story", {
      label: "色彩故事",
      fieldset: "fashion_womens_dresses",
      group: { code: "finish" },
    }),
  ]),
  defineFields(E.catalog.catalog_product, [
    cf.integer("service_duration_minutes", {
      label: "服务时长（分钟）",
      description: "单次服务预约的时长。",
      fieldset: "service_schedule",
      group: { code: "timing" },
      filterable: true,
      required: true,
    }),
    cf.integer("service_buffer_minutes", {
      label: "预约间隔",
      description: "连续服务时段之间的最短整理时间（分钟）。",
      fieldset: "service_schedule",
      group: { code: "timing" },
    }),
    cf.text("service_location", {
      label: "服务地点 / 房间",
      description: "服务交付的地点。",
      fieldset: "service_schedule",
      group: { code: "identity" },
    }),
    cf.select(
      "service_resources",
      ["stylist", "therapist", "treatment_room", "wash_station", "steam_room"],
      {
        label: "所需资源",
        description: "完成服务所需的人员或房间。",
        fieldset: "service_schedule",
        group: { code: "resources" },
        multi: true,
      },
    ),
    cf.boolean("service_remote_available", {
      label: "支持远程服务",
      description: "标记该服务是否可远程或线上完成。",
      fieldset: "service_schedule",
      group: { code: "resources" },
      defaultValue: false,
    }),
  ]),
  defineFields(E.catalog.catalog_product_variant, [
    cf.select("provider_level", ["junior", "senior", "master"], {
      label: "服务人员级别",
      description: "指定服务人员的资历级别。",
      fieldset: "service_schedule",
      group: { code: "provider" },
      filterable: true,
    }),
    cf.text("staff_member", {
      label: "服务人员",
      description: "通常交付该服务变体的员工姓名。",
      fieldset: "service_schedule",
      group: { code: "provider" },
    }),
    cf.select("environment_type", ["studio", "suite", "on_site"], {
      label: "服务环境",
      description: "该服务时段的承接环境。",
      fieldset: "service_schedule",
      group: { code: "environment" },
    }),
  ]),
];

type CategorySeed = {
  slug: string;
  name: string;
  description?: string;
  children?: CategorySeed[];
};

const CATEGORY_TREE: CategorySeed[] = [
  {
    slug: "fashion",
    name: "服饰",
    description: "季节性商品组合与垂直品类集合。",
    children: [
      {
        slug: "fashion-men",
        name: "男装",
        children: [
          {
            slug: "fashion-men-footwear",
            name: "鞋履",
            description: "高端运动鞋、靴履和凉鞋。",
          },
        ],
      },
      {
        slug: "fashion-women",
        name: "女装",
        children: [
          {
            slug: "fashion-women-dresses-jumpsuits",
            name: "连衣裙与连体裤",
            description: "适合多种场景的连衣裙与剪裁连体裤。",
          },
        ],
      },
    ],
  },
  {
    slug: "services",
    name: "服务",
    description: "可预约的到店和线上体验服务。",
    children: [
      {
        slug: "services-hairdresser",
        name: "美发",
        description: "从快速修剪到造型设计的沙龙服务。",
      },
      {
        slug: "services-massage",
        name: "按摩",
        description: "身体护理与放松疗愈服务。",
      },
    ],
  },
];

type MediaSeed = {
  file: string;
  title?: string;
};

type VariantSeed = {
  name: string;
  sku: string;
  isDefault?: boolean;
  optionValues?: Record<string, string>;
  prices: {
    regular: number;
    sale?: number;
  };
  customFields?: Record<string, string | number | boolean | null>;
  media?: MediaSeed[];
};

type ProductSeed = {
  title: string;
  handle: string | null;
  legacyHandles?: string[];
  sku?: string;
  description: string;
  categorySlug: string;
  customFieldsetCode: string;
  variantFieldsetCode: string;
  unit: string;
  metadata?: Record<string, unknown>;
  customFields?: Record<string, string | number | boolean | null>;
  media?: MediaSeed[];
  variants: VariantSeed[];
};

const PRODUCT_SEEDS: ProductSeed[] = [
  {
    title: "阿特拉斯轻量缓震跑鞋",
    handle: null,
    legacyHandles: ["atlas-runner-sneaker"],
    sku: "ATLAS-RUNNER",
    description:
      "轻量公路跑鞋，采用透气针织鞋面、再生 TPU 覆片和分离式后跟结构，适合日常训练、通勤慢跑和门店陈列讲解。",
    categorySlug: "fashion-men-footwear",
    customFieldsetCode: "fashion_mens_footwear",
    variantFieldsetCode: "fashion_mens_footwear",
    unit: "pair",
    metadata: { division: "RunLab", season: "SS25" },
    customFields: {
      style_code: "AR-2025",
      upper_material: "engineered_knit",
      cushioning_profile: "responsive",
      care_notes: "每次跑步后局部清洁并自然晾干，避免机器烘干。",
    },
    media: [{ file: "atlas-runner-midnight-1.png" }],
    variants: [
      {
        name: "午夜蓝 · 美码 8",
        sku: "ATLAS-RUN-NAVY-8",
        isDefault: true,
        optionValues: { color: "午夜蓝", size: "美码 8" },
        prices: { regular: 168, sale: 148 },
        customFields: {
          shoe_size: 8,
          shoe_width: "D",
          colorway: "午夜蓝",
        },
        media: [
          { file: "atlas-runner-midnight-1.png" },
          { file: "atlas-runner-midnight-2.png" },
        ],
      },
      {
        name: "冰川灰 · 美码 10",
        sku: "ATLAS-RUN-GLACIER-10",
        optionValues: { color: "冰川灰", size: "美码 10" },
        prices: { regular: 168, sale: 138 },
        customFields: {
          shoe_size: 10,
          shoe_width: "EE",
          colorway: "冰川灰",
        },
        media: [
          { file: "atlas-runner-glacier-1.png" },
          { file: "atlas-runner-glacier-2.png" },
        ],
      },
    ],
  },
  {
    title: "极光真丝裹身礼服连衣裙",
    handle: null,
    legacyHandles: ["aurora-wrap-dress"],
    sku: "AURORA-WRAP",
    description:
      "斜裁裹身连衣裙，配灯笼袖、哑光真丝混纺面料与隐藏内扣，适合晚宴、发布会、度假场景、搭配陈列和会员造型推荐。",
    categorySlug: "fashion-women-dresses-jumpsuits",
    customFieldsetCode: "fashion_womens_dresses",
    variantFieldsetCode: "fashion_womens_dresses",
    unit: "unit",
    metadata: { capsule: "晚宴工坊", season: "Resort 25" },
    customFields: {
      silhouette: "wrap",
      fabric_mix: "silk_blend",
      occasion_ready: "evening",
      finishing_details: "手工收边，并在裹身边缘加入同色细珠装饰。",
    },
    media: [{ file: "aurora-wrap-rosewood.png" }],
    variants: [
      {
        name: "玫瑰木色 · M",
        sku: "AURORA-ROSE-M",
        isDefault: true,
        optionValues: { color: "玫瑰木色", size: "M" },
        prices: { regular: 248, sale: 212 },
        customFields: {
          numeric_size: 6,
          length_profile: "midi",
          color_story: "玫瑰木色",
        },
        media: [{ file: "aurora-wrap-rosewood.png" }],
      },
      {
        name: "星空蓝 · L",
        sku: "AURORA-CELESTIAL-L",
        optionValues: { color: "星空蓝", size: "L" },
        prices: { regular: 248, sale: 198 },
        customFields: {
          numeric_size: 8,
          length_profile: "maxi",
          color_story: "星空蓝",
        },
        media: [{ file: "aurora-wrap-celestial.png" }],
      },
    ],
  },
  {
    title: "招牌洗剪护理造型服务",
    handle: null,
    legacyHandles: ["signature-haircut-service"],
    sku: "SERV-HAIR-60",
    description:
      "包含个性化修剪、放松洗护、头皮按摩和最终造型，适合在演示门户中展示可预约服务、员工排班、门店交付和复购提醒。",
    categorySlug: "services-hairdresser",
    customFieldsetCode: "service_schedule",
    variantFieldsetCode: "service_schedule",
    unit: "hour",
    metadata: { channel: "salon", serviceType: "hairdresser" },
    customFields: {
      service_duration_minutes: 60,
      service_buffer_minutes: 15,
      service_location: "沙龙 3 号造型间",
      service_resources: "stylist,wash_station",
      service_remote_available: false,
    },
    media: [{ file: "hairdresser-service.png" }],
    variants: [
      {
        name: "资深造型师 · 60 分钟",
        sku: "SERV-HAIR-60-SENIOR",
        isDefault: true,
        optionValues: { stylist: "资深", duration: "60 分钟" },
        prices: { regular: 95, sale: 85 },
        customFields: {
          provider_level: "senior",
          staff_member: "安然",
          environment_type: "studio",
        },
        media: [{ file: "hairdresser-service.png" }],
      },
    ],
  },
  {
    title: "舒缓修复芳疗按摩疗程",
    handle: null,
    legacyHandles: ["restorative-massage-service"],
    sku: "SERV-MASSAGE-90",
    description:
      "全身按摩搭配芳疗精油和呼吸引导，包含欢迎饮品与护理室配套服务，适合展示预约型服务商品、复购运营和会员护理套餐。",
    categorySlug: "services-massage",
    customFieldsetCode: "service_schedule",
    variantFieldsetCode: "service_schedule",
    unit: "hour",
    metadata: { channel: "wellness", serviceType: "massage" },
    customFields: {
      service_duration_minutes: 90,
      service_buffer_minutes: 20,
      service_location: "康养 B 套间",
      service_resources: "therapist,treatment_room,steam_room",
      service_remote_available: false,
    },
    media: [{ file: "massage-service.png" }],
    variants: [
      {
        name: "首席理疗师 · 90 分钟",
        sku: "SERV-MASSAGE-90-MASTER",
        isDefault: true,
        optionValues: { therapist: "首席", duration: "90 分钟" },
        prices: { regular: 140, sale: 120 },
        customFields: {
          provider_level: "master",
          staff_member: "李诺",
          environment_type: "suite",
        },
        media: [{ file: "massage-service.png" }],
      },
    ],
  },
];

const CHANNEL_DEFINITION = {
  code: "fashion-online",
  name: "Helios 精品线上商城",
  description: "面向消费者的线上门店，用于展示高质量演示商品。",
  websiteUrl: "https://demo.helios.com",
  contactEmail: "store@helios.com",
};

function formatMoney(value: number): string {
  return value.toFixed(2);
}

function normalizeSeedKey(value: string | null | undefined): string {
  return (value ?? "").trim().toLowerCase();
}

function compactSeedStrings(values: Array<string | null | undefined>): string[] {
  return Array.from(new Set(values.map((value) => value?.trim()).filter((value): value is string => Boolean(value))));
}

async function resolveDefaultTaxRate(
  em: EntityManager,
  scope: SeedScope,
): Promise<SalesTaxRate | null> {
  const [rate] = await em.find(
    SalesTaxRate,
    {
      tenantId: scope.tenantId,
      organizationId: scope.organizationId,
      deletedAt: null,
    },
    {
      limit: 1,
      orderBy: {
        isDefault: "DESC",
        priority: "ASC",
        rate: "DESC",
        createdAt: "ASC",
      },
    },
  );
  return rate ?? null;
}

async function ensureFieldsetConfig(
  em: EntityManager,
  scope: SeedScope,
  entityId: string,
  fieldsets: typeof PRODUCT_FIELDSETS | typeof VARIANT_FIELDSETS,
): Promise<void> {
  const now = new Date();
  let config = await em.findOne(CustomFieldEntityConfig, {
    entityId,
    organizationId: scope.organizationId,
    tenantId: scope.tenantId,
  });
  if (!config) {
    config = em.create(CustomFieldEntityConfig, {
      id: randomUUID(),
      entityId,
      organizationId: scope.organizationId,
      tenantId: scope.tenantId,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    });
  }
  config.configJson = {
    fieldsets,
    singleFieldsetPerRecord: true,
  };
  config.isActive = true;
  config.updatedAt = now;
  em.persist(config);
}

async function ensureFieldsetsAndDefinitions(
  em: EntityManager,
  scope: SeedScope,
): Promise<void> {
  await ensureFieldsetConfig(
    em,
    scope,
    E.catalog.catalog_product,
    PRODUCT_FIELDSETS,
  );
  await ensureFieldsetConfig(
    em,
    scope,
    E.catalog.catalog_product_variant,
    VARIANT_FIELDSETS,
  );
  await ensureCustomFieldDefinitions(em, CUSTHELIOS_FIELD_SETS, {
    organizationId: scope.organizationId,
    tenantId: scope.tenantId,
  });
  await em.flush();
}

async function ensureCategories(
  em: EntityManager,
  scope: SeedScope,
): Promise<Map<string, CatalogProductCategory>> {
  const map = new Map<string, CatalogProductCategory>();
  const now = new Date();

  const upsert = async (
    seed: CategorySeed,
    parent: CatalogProductCategory | null,
  ) => {
    let record = await em.findOne(CatalogProductCategory, {
      tenantId: scope.tenantId,
      organizationId: scope.organizationId,
      slug: seed.slug,
    });
    if (!record) {
      record = em.create(CatalogProductCategory, {
        id: randomUUID(),
        organizationId: scope.organizationId,
        tenantId: scope.tenantId,
        name: seed.name,
        slug: seed.slug,
        description: seed.description ?? null,
        parentId: parent ? parent.id : null,
        rootId: parent ? (parent.rootId ?? parent.id) : null,
        treePath: null,
        depth: parent ? (parent.depth ?? 0) + 1 : 0,
        ancestorIds: [],
        childIds: [],
        descendantIds: [],
        metadata: null,
        isActive: true,
        createdAt: now,
        updatedAt: now,
      });
      em.persist(record);
    } else {
      record.name = seed.name;
      record.description = seed.description ?? null;
      record.parentId = parent ? parent.id : null;
      record.isActive = true;
      record.updatedAt = now;
    }
    map.set(seed.slug, record);
    if (Array.isArray(seed.children)) {
      for (const child of seed.children) {
        await upsert(child, record);
      }
    }
  };

  for (const seed of CATEGORY_TREE) {
    await upsert(seed, null);
  }

  await em.flush();
  await rebuildCategoryHierarchyForOrganization(
    em,
    scope.organizationId,
    scope.tenantId,
  );

  return map;
}

async function ensureChannel(
  em: EntityManager,
  scope: SeedScope,
): Promise<SalesChannel> {
  const now = new Date();
  let channel = await em.findOne(SalesChannel, {
    tenantId: scope.tenantId,
    organizationId: scope.organizationId,
    code: CHANNEL_DEFINITION.code,
    deletedAt: null,
  });
  if (!channel) {
    channel = em.create(SalesChannel, {
      id: randomUUID(),
      organizationId: scope.organizationId,
      tenantId: scope.tenantId,
      code: CHANNEL_DEFINITION.code,
      name: CHANNEL_DEFINITION.name,
      description: CHANNEL_DEFINITION.description,
      websiteUrl: CHANNEL_DEFINITION.websiteUrl,
      contactEmail: CHANNEL_DEFINITION.contactEmail,
      status: "active",
      isActive: true,
      metadata: { locale: "zh-CN" },
      createdAt: now,
      updatedAt: now,
    });
    em.persist(channel);
    await em.flush();
  } else {
    channel.name = CHANNEL_DEFINITION.name;
    channel.description = CHANNEL_DEFINITION.description;
    channel.websiteUrl = CHANNEL_DEFINITION.websiteUrl;
    channel.contactEmail = CHANNEL_DEFINITION.contactEmail;
    channel.status = "active";
    channel.isActive = true;
    channel.metadata = { locale: "zh-CN" };
    channel.updatedAt = now;
    em.persist(channel);
  }
  return channel;
}

async function ensureVariantPrice(
  em: EntityManager,
  scope: SeedScope,
  input: {
    product: CatalogProduct;
    variant: CatalogProductVariant;
    offer: CatalogOffer;
    priceKind: CatalogPriceKind;
    channelId: string;
    taxRate: string | null;
    amount: number;
  },
): Promise<boolean> {
  const now = new Date();
  const amount = formatMoney(input.amount);
  let price = await em.findOne(CatalogProductPrice, {
    tenantId: scope.tenantId,
    organizationId: scope.organizationId,
    product: input.product,
    variant: input.variant,
    offer: input.offer,
    priceKind: input.priceKind,
    channelId: input.channelId,
    kind: input.priceKind.code,
  });
  if (!price) {
    price = em.create(CatalogProductPrice, {
      id: randomUUID(),
      organizationId: scope.organizationId,
      tenantId: scope.tenantId,
      product: input.product,
      variant: input.variant,
      offer: input.offer,
      priceKind: input.priceKind,
      currencyCode: "USD",
      kind: input.priceKind.code,
      minQuantity: 1,
      taxRate: input.taxRate,
      unitPriceGross: amount,
      unitPriceNet: amount,
      channelId: input.channelId,
      createdAt: now,
      updatedAt: now,
    });
    em.persist(price);
    return true;
  }

  let changed = false;
  if (price.currencyCode !== "USD") {
    price.currencyCode = "USD";
    changed = true;
  }
  if (price.minQuantity !== 1) {
    price.minQuantity = 1;
    changed = true;
  }
  if (price.taxRate !== input.taxRate) {
    price.taxRate = input.taxRate;
    changed = true;
  }
  if (price.unitPriceGross !== amount) {
    price.unitPriceGross = amount;
    changed = true;
  }
  if (price.unitPriceNet !== amount) {
    price.unitPriceNet = amount;
    changed = true;
  }
  if (changed) {
    price.updatedAt = now;
    em.persist(price);
  }
  return changed;
}

async function loadPriceKinds(
  em: EntityManager,
  scope: SeedScope,
): Promise<Map<string, CatalogPriceKind>> {
  const kinds = await em.find(CatalogPriceKind, {
    tenantId: scope.tenantId,
    code: { $in: ["regular", "sale"] },
    deletedAt: null,
  });
  const map = new Map<string, CatalogPriceKind>();
  for (const kind of kinds) {
    map.set(kind.code.toLowerCase(), kind);
  }
  return map;
}

export async function seedCatalogExamples(
  em: EntityManager,
  container: AwilixContainer,
  scope: SeedScope,
): Promise<boolean> {
  await ensureFieldsetsAndDefinitions(em, scope);
  await ensureDefaultPartitions(em);

  const handles = compactSeedStrings(
    PRODUCT_SEEDS.flatMap((seed) => [seed.handle, ...(seed.legacyHandles ?? [])]),
  );
  const skus = compactSeedStrings(PRODUCT_SEEDS.map((seed) => seed.sku));
  const existingProducts = await em.find(CatalogProduct, {
    tenantId: scope.tenantId,
    organizationId: scope.organizationId,
    $or: [
      ...(handles.length ? [{ handle: { $in: handles } }] : []),
      ...(skus.length ? [{ sku: { $in: skus } }] : []),
    ],
  });
  const existingByHandle = new Map(
    existingProducts
      .filter((product) => product.handle)
      .map((product) => [normalizeSeedKey(product.handle), product]),
  );
  const existingBySku = new Map(
    existingProducts
      .filter((product) => product.sku)
      .map((product) => [normalizeSeedKey(product.sku), product]),
  );

  const categoryMap = await ensureCategories(em, scope);
  const channel = await ensureChannel(em, scope);
  const priceKinds = await loadPriceKinds(em, scope);
  const regularKind = priceKinds.get("regular");
  const saleKind = priceKinds.get("sale");
  const defaultTaxRate = await resolveDefaultTaxRate(em, scope);
  const defaultTaxRateId = defaultTaxRate?.id ?? null;
  const defaultTaxRateValue = defaultTaxRate?.rate ?? null;
  if (!regularKind || !saleKind) {
    throw new Error(
      "Missing catalog price kinds; run `helios catalog seed-price-kinds` first.",
    );
  }

  const dataEngine = new DefaultDataEngine(em, container);
  const customFieldAssignments: Array<() => Promise<void>> = [];
  let changedAny = false;

  for (const productSeed of PRODUCT_SEEDS) {
    const lookupHandles = compactSeedStrings([productSeed.handle, ...(productSeed.legacyHandles ?? [])]);
    let product =
      lookupHandles.map((handle) => existingByHandle.get(normalizeSeedKey(handle))).find(Boolean) ??
      (productSeed.sku ? existingBySku.get(normalizeSeedKey(productSeed.sku)) : undefined);
    const defaultUnit = canonicalizeUnitCode(productSeed.unit) ?? productSeed.unit;
    if (!product) {
      changedAny = true;
      product = em.create(CatalogProduct, {
        id: randomUUID(),
        organizationId: scope.organizationId,
        tenantId: scope.tenantId,
        title: productSeed.title,
        description: productSeed.description,
        sku: productSeed.sku ?? null,
        handle: productSeed.handle,
        productType: "configurable",
        primaryCurrencyCode: "USD",
        defaultUnit,
        customFieldsetCode: productSeed.customFieldsetCode,
        metadata: productSeed.metadata ?? null,
        taxRateId: defaultTaxRateId,
        taxRate: defaultTaxRateValue,
        isConfigurable: true,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      em.persist(product);
    } else {
      let productChanged = false;
      const nextMetadata = productSeed.metadata ?? null;
      if (product.title !== productSeed.title) {
        product.title = productSeed.title;
        productChanged = true;
      }
      if (product.description !== productSeed.description) {
        product.description = productSeed.description;
        productChanged = true;
      }
      if (product.sku !== (productSeed.sku ?? null)) {
        product.sku = productSeed.sku ?? null;
        productChanged = true;
      }
      if (product.handle !== productSeed.handle) {
        product.handle = productSeed.handle;
        productChanged = true;
      }
      if (product.productType !== "configurable") {
        product.productType = "configurable";
        productChanged = true;
      }
      if (product.primaryCurrencyCode !== "USD") {
        product.primaryCurrencyCode = "USD";
        productChanged = true;
      }
      if (product.defaultUnit !== defaultUnit) {
        product.defaultUnit = defaultUnit;
        productChanged = true;
      }
      if (product.customFieldsetCode !== productSeed.customFieldsetCode) {
        product.customFieldsetCode = productSeed.customFieldsetCode;
        productChanged = true;
      }
      if (JSON.stringify(product.metadata ?? null) !== JSON.stringify(nextMetadata)) {
        product.metadata = nextMetadata;
        productChanged = true;
      }
      if (product.taxRateId !== defaultTaxRateId) {
        product.taxRateId = defaultTaxRateId;
        productChanged = true;
      }
      if (product.taxRate !== defaultTaxRateValue) {
        product.taxRate = defaultTaxRateValue;
        productChanged = true;
      }
      if (product.isConfigurable !== true) {
        product.isConfigurable = true;
        productChanged = true;
      }
      if (product.isActive !== true) {
        product.isActive = true;
        productChanged = true;
      }
      if (productChanged) {
        changedAny = true;
        product.updatedAt = new Date();
        em.persist(product);
      }
    }

    const category = categoryMap.get(productSeed.categorySlug);
    if (category) {
      const existingAssignment = await em.findOne(CatalogProductCategoryAssignment, {
        tenantId: scope.tenantId,
        organizationId: scope.organizationId,
        product,
        category,
      });
      if (!existingAssignment) {
        changedAny = true;
        const assignment = em.create(CatalogProductCategoryAssignment, {
          id: randomUUID(),
          organizationId: scope.organizationId,
          tenantId: scope.tenantId,
          product,
          category,
          position: 0,
          createdAt: new Date(),
          updatedAt: new Date(),
        });
        em.persist(assignment);
      }
    }

    let offer = await em.findOne(CatalogOffer, {
      tenantId: scope.tenantId,
      organizationId: scope.organizationId,
      product,
      channelId: channel.id,
      deletedAt: null,
    });
    const offerTitle = `${productSeed.title} · 线上`;
    const offerDescription = "为演示线上门店配置的精选报价。";
    if (!offer) {
      changedAny = true;
      offer = em.create(CatalogOffer, {
        id: randomUUID(),
        organizationId: scope.organizationId,
        tenantId: scope.tenantId,
        product,
        channelId: channel.id,
        title: offerTitle,
        description: offerDescription,
        metadata: { channelCode: CHANNEL_DEFINITION.code },
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      em.persist(offer);
    } else {
      if (offer.title !== offerTitle) {
        offer.title = offerTitle;
        changedAny = true;
      }
      if (offer.description !== offerDescription) {
        offer.description = offerDescription;
        changedAny = true;
      }
      offer.metadata = { channelCode: CHANNEL_DEFINITION.code };
      offer.isActive = true;
      offer.updatedAt = new Date();
      em.persist(offer);
    }

    if (
      productSeed.customFields &&
      Object.keys(productSeed.customFields).length
    ) {
      const payload = { ...productSeed.customFields };
      customFieldAssignments.push(() =>
        dataEngine.setCustomFields({
          entityId: E.catalog.catalog_product,
          recordId: product.id,
          organizationId: scope.organizationId,
          tenantId: scope.tenantId,
          values: payload,
        }),
      );
    }

    if (!product.defaultMediaId) {
      const productMedia = await attachMediaFromExamples(
        em,
        scope,
        E.catalog.catalog_product,
        product.id,
        productSeed.media,
      );
      if (productMedia.length) {
        changedAny = true;
        const hero = productMedia[0];
        product.defaultMediaId = hero.id;
        product.defaultMediaUrl = hero.imageUrl;
        offer.defaultMediaId = hero.id;
        offer.defaultMediaUrl = hero.imageUrl;
      }
    }

    const existingVariants = await em.find(CatalogProductVariant, {
      tenantId: scope.tenantId,
      organizationId: scope.organizationId,
      product,
      sku: { $in: productSeed.variants.map((variant) => variant.sku) },
      deletedAt: null,
    });
    const variantBySku = new Map(existingVariants.map((variant) => [normalizeSeedKey(variant.sku), variant]));

    for (const variantSeed of productSeed.variants) {
      let variant = variantBySku.get(normalizeSeedKey(variantSeed.sku));
      if (!variant) {
        changedAny = true;
        variant = em.create(CatalogProductVariant, {
          id: randomUUID(),
          organizationId: scope.organizationId,
          tenantId: scope.tenantId,
          product,
          name: variantSeed.name,
          sku: variantSeed.sku,
          isDefault: variantSeed.isDefault ?? false,
          optionValues: variantSeed.optionValues ?? null,
          customFieldsetCode: productSeed.variantFieldsetCode,
          metadata: null,
          taxRateId: defaultTaxRateId,
          taxRate: defaultTaxRateValue,
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        });
        em.persist(variant);
      } else {
        const nextOptionValues = variantSeed.optionValues ?? null;
        if (variant.name !== variantSeed.name) {
          variant.name = variantSeed.name;
          changedAny = true;
        }
        if (variant.isDefault !== (variantSeed.isDefault ?? false)) {
          variant.isDefault = variantSeed.isDefault ?? false;
          changedAny = true;
        }
        if (JSON.stringify(variant.optionValues ?? null) !== JSON.stringify(nextOptionValues)) {
          variant.optionValues = nextOptionValues;
          changedAny = true;
        }
        if (variant.customFieldsetCode !== productSeed.variantFieldsetCode) {
          variant.customFieldsetCode = productSeed.variantFieldsetCode;
          changedAny = true;
        }
        variant.taxRateId = defaultTaxRateId;
        variant.taxRate = defaultTaxRateValue;
        variant.isActive = true;
        variant.updatedAt = new Date();
        em.persist(variant);
      }

      if (!variant.defaultMediaId) {
        await attachMediaFromExamples(
          em,
          scope,
          E.catalog.catalog_product_variant,
          variant.id,
          variantSeed.media,
        );
      }
      changedAny = (await ensureVariantPrice(em, scope, {
        product,
        variant,
        offer,
        priceKind: regularKind,
        channelId: channel.id,
        taxRate: defaultTaxRateValue,
        amount: variantSeed.prices.regular,
      })) || changedAny;

      if (variantSeed.prices.sale !== undefined) {
        changedAny = (await ensureVariantPrice(em, scope, {
          product,
          variant,
          offer,
          priceKind: saleKind,
          channelId: channel.id,
          taxRate: defaultTaxRateValue,
          amount: variantSeed.prices.sale,
        })) || changedAny;
      }

      if (
        variantSeed.customFields &&
        Object.keys(variantSeed.customFields).length
      ) {
        const payload = { ...variantSeed.customFields };
        customFieldAssignments.push(() =>
          dataEngine.setCustomFields({
            entityId: E.catalog.catalog_product_variant,
            recordId: variant.id,
            organizationId: scope.organizationId,
            tenantId: scope.tenantId,
            values: payload,
          }),
        );
      }
    }
  }

  await em.flush();

  for (const assign of customFieldAssignments) {
    try {
      await assign();
    } catch (err) {
      logger.warn("catalog.seed failed to set example custom field values", { err });
    }
  }

  return changedAny || customFieldAssignments.length > 0;
}
