import { pgTable, pgSchema, index, varchar, timestamp, uniqueIndex, text, jsonb, boolean, unique, serial, uuid, vector, integer, primaryKey, foreignKey } from "drizzle-orm/pg-core"
import { sql } from "drizzle-orm"

export const lc = pgSchema("lc");
export const bindingStatusInLc = lc.enum("binding_status", ['ENABLED', 'DISABLED'])
export const channelCapabilityInLc = lc.enum("channel_capability", ['INBOUND', 'OUTBOUND', 'STREAMING', 'CARD'])
export const channelStatusInLc = lc.enum("channel_status", ['ACTIVE', 'ERROR', 'INACTIVE', 'DISABLED'])
export const chatConversationTypeInLc = lc.enum("chat_conversation_type", ['chart_analysis', 'document_assistant', 'app_chat', 'global_chat', 'general'])
export const chatMessageRoleInLc = lc.enum("chat_message_role", ['user', 'assistant', 'system', 'tool'])
export const chatMessageSegmentTypeInLc = lc.enum("chat_message_segment_type", ['user', 'assistant', 'system', 'thought', 'tool_call', 'tool_output', 'chart_data'])
export const documentTypeInLc = lc.enum("document_type", ['general', 'ai_memory', 'ai_memory_archive'])
export const fileStatusInLc = lc.enum("file_status", ['temp', 'available', 'archived', 'deleted'])
export const permissionLevelInLc = lc.enum("permission_level", ['VIEW', 'EDIT'])
export const shareTargetTypeInLc = lc.enum("share_target_type", ['ALL', 'ROLE', 'DEPARTMENT', 'USER'])
export const storageProviderInLc = lc.enum("storage_provider", ['local', 's3', 'oss', 'gcs', 'qiniu'])


export const employeeSessionHistoryInLc = lc.table("employee_session_history", {
	id: varchar({ length: 255 }).primaryKey().notNull(),
	employeeId: varchar("employee_id", { length: 255 }).notNull(),
	sessionId: varchar("session_id", { length: 255 }).notNull(),
	joinedAt: timestamp("joined_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("esh_employee_idx").using("btree", table.employeeId.asc().nullsLast().op("text_ops")),
	index("esh_session_idx").using("btree", table.sessionId.asc().nullsLast().op("text_ops")),
]);

export const appResourcesInLc = lc.table("app_resources", {
	id: varchar({ length: 255 }).primaryKey().notNull(),
	appId: varchar("app_id", { length: 255 }).notNull(),
	type: text().notNull(),
	refId: varchar("ref_id", { length: 255 }).notNull(),
	parentId: varchar("parent_id", { length: 255 }),
	order: varchar({ length: 1024 }).default('m').notNull(),
	meta: jsonb().default({}).notNull(),
	hidden: boolean().default(false).notNull(),
	pinned: boolean().default(false).notNull(),
	deleted: boolean().default(false).notNull(),
	deletedAt: timestamp("deleted_at", { mode: 'string' }),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("app_resources_app_id_idx").using("btree", table.appId.asc().nullsLast().op("text_ops")),
	index("app_resources_compound_order_idx").using("btree", table.appId.asc().nullsLast().op("text_ops"), table.parentId.asc().nullsLast().op("text_ops"), table.order.asc().nullsLast().op("text_ops")),
	index("app_resources_deleted_idx").using("btree", table.deleted.asc().nullsLast().op("bool_ops")),
	index("app_resources_parent_id_idx").using("btree", table.parentId.asc().nullsLast().op("text_ops")),
	uniqueIndex("app_resources_unique_ref_idx").using("btree", table.appId.asc().nullsLast().op("text_ops"), table.type.asc().nullsLast().op("text_ops"), table.refId.asc().nullsLast().op("text_ops")),
]);

export const workflowsInLc = lc.table("workflows", {
	id: varchar({ length: 255 }).primaryKey().notNull(),
	name: varchar({ length: 255 }).notNull(),
	workflowKey: varchar("workflow_key", { length: 255 }),
	description: text(),
	organizationId: varchar("organization_id", { length: 255 }),
	appId: varchar("app_id", { length: 255 }),
	scope: varchar({ length: 50 }).default('APP'),
	category: varchar({ length: 50 }).default('GENERAL'),
	isSkill: boolean("is_skill").default(false),
	skillConfig: jsonb("skill_config").default({}),
	nodes: jsonb().default([]),
	edges: jsonb().default([]),
	status: varchar({ length: 20 }).default('INACTIVE'),
	triggerType: varchar("trigger_type", { length: 50 }).notNull(),
	triggerConfig: jsonb("trigger_config").default({}),
	lastRunAt: timestamp("last_run_at", { withTimezone: true, mode: 'string' }),
	createdBy: varchar("created_by", { length: 255 }),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
});

export const workflowExecutionsInLc = lc.table("workflow_executions", {
	id: varchar({ length: 255 }).primaryKey().notNull(),
	workflowId: varchar("workflow_id", { length: 255 }).notNull(),
	organizationId: varchar("organization_id", { length: 255 }),
	status: varchar({ length: 20 }).default('RUNNING'),
	temporalWorkflowId: varchar("temporal_workflow_id", { length: 255 }),
	temporalRunId: varchar("temporal_run_id", { length: 255 }),
	startTime: timestamp("start_time", { withTimezone: true, mode: 'string' }).defaultNow(),
	endTime: timestamp("end_time", { withTimezone: true, mode: 'string' }),
	nodeResults: jsonb("node_results").default({}),
	error: jsonb().default({}),
	triggerData: jsonb("trigger_data").default({}),
	triggeredBy: varchar("triggered_by", { length: 255 }),
	resourceId: varchar("resource_id", { length: 255 }),
	resourceType: varchar("resource_type", { length: 255 }),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
});

export const gatewayChannelsInLc = lc.table("gateway_channels", {
	id: varchar({ length: 255 }).primaryKey().notNull(),
	name: text().notNull(),
	providerId: text("provider_id").notNull(),
	config: jsonb().default({}).notNull(),
	appId: varchar("app_id", { length: 255 }),
	organizationId: varchar("organization_id", { length: 255 }).notNull(),
	status: channelStatusInLc().default('ACTIVE'),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow().notNull(),
	employeeId: text("employee_id").notNull(),
});

export const gatewaySessionsInLc = lc.table("gateway_sessions", {
	id: varchar({ length: 255 }).primaryKey().notNull(),
	sessionId: text("session_id").notNull(),
	platform: text().notNull(),
	channelId: varchar("channel_id", { length: 255 }),
	platformMetadata: jsonb("platform_metadata").default({}).notNull(),
	lastActiveAt: timestamp("last_active_at", { mode: 'string' }).defaultNow().notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	unique("gateway_sessions_session_id_unique").on(table.sessionId),
]);

export const chatConversationsInLc = lc.table("chat_conversations", {
	id: varchar({ length: 255 }).primaryKey().notNull(),
	userId: varchar("user_id", { length: 255 }),
	appId: varchar("app_id", { length: 255 }),
	title: varchar({ length: 500 }),
	type: chatConversationTypeInLc().default('general').notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
});

export const memoryMigrationsInLc = lc.table("memory_migrations", {
	id: serial().primaryKey().notNull(),
	userId: text("user_id").notNull(),
}, (table) => [
	unique("memory_migrations_user_id_key").on(table.userId),
]);

export const mem0InLc = lc.table("mem0", {
	id: uuid().primaryKey().notNull(),
	vector: vector({ dimensions: 1024 }),
	payload: jsonb(),
});

export const gatewayWorkflowBindingsInLc = lc.table("gateway_workflow_bindings", {
	id: varchar({ length: 255 }).primaryKey().notNull(),
	workflowId: varchar("workflow_id", { length: 255 }).notNull(),
	triggerConfig: jsonb("trigger_config").default({}).notNull(),
	status: bindingStatusInLc().default('ENABLED'),
	organizationId: varchar("organization_id", { length: 255 }),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow().notNull(),
	targetSessionId: varchar("target_session_id", { length: 255 }),
	cron: varchar({ length: 255 }),
});

export const chatMessagesInLc = lc.table("chat_messages", {
	id: varchar({ length: 255 }).primaryKey().notNull(),
	conversationId: varchar("conversation_id", { length: 255 }).notNull(),
	responseMetadata: jsonb("response_metadata"),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	role: chatMessageRoleInLc().default('user').notNull(),
});

export const digitalEmployeesInLc = lc.table("digital_employees", {
	id: varchar({ length: 255 }).primaryKey().notNull(),
	appRef: varchar("app_ref", { length: 255 }).notNull(),
	name: varchar({ length: 100 }).notNull(),
	roleTitle: varchar("role_title", { length: 200 }),
	avatar: text(),
	description: text(),
	workflowId: varchar("workflow_id", { length: 255 }).notNull(),
	isActive: boolean("is_active").default(true),
	metadata: jsonb().default({"model":"gpt-4o","temperature":0.7}),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	createdBy: varchar("created_by", { length: 255 }).notNull(),
	updatedBy: varchar("updated_by", { length: 255 }),
}, (table) => [
	index("de_app_ref_idx").using("btree", table.appRef.asc().nullsLast().op("text_ops")),
	index("de_workflow_idx").using("btree", table.workflowId.asc().nullsLast().op("text_ops")),
]);

export const chatMessageSegmentsInLc = lc.table("chat_message_segments", {
	id: varchar({ length: 255 }).primaryKey().notNull(),
	messageId: varchar("message_id", { length: 255 }).notNull(),
	type: chatMessageSegmentTypeInLc().notNull(),
	content: jsonb(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
}, (table) => [
	index("chat_seg_message_idx").using("btree", table.messageId.asc().nullsLast().op("text_ops")),
]);

export const knowledgeSetsInLc = lc.table("knowledge_sets", {
	id: varchar({ length: 255 }).primaryKey().notNull(),
	name: varchar({ length: 255 }).notNull(),
	description: text().default('),
	appRef: varchar("app_ref", { length: 255 }).notNull(),
	createdBy: varchar("created_by", { length: 255 }),
	updatedBy: varchar("updated_by", { length: 255 }),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("ks_app_ref_idx").using("btree", table.appRef.asc().nullsLast().op("text_ops")),
	index("ks_name_idx").using("btree", table.name.asc().nullsLast().op("text_ops")),
]);

export const documentsInLc = lc.table("documents", {
	id: varchar({ length: 255 }).primaryKey().notNull(),
	docType: documentTypeInLc("doc_type").default('general').notNull(),
	appRef: varchar("app_ref", { length: 255 }),
	title: varchar({ length: 255 }).default(').notNull(),
	blocks: jsonb().default([]).notNull(),
	contentPlain: text("content_plain").default(').notNull(),
	attachments: jsonb().default([]).notNull(),
	originalFileId: varchar("original_file_id", { length: 255 }),
	tags: varchar({ length: 255 }).array().default([""]).notNull(),
	createdBy: varchar("created_by", { length: 255 }),
	updatedBy: varchar("updated_by", { length: 255 }),
	shares: jsonb().default([]).notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("documents_app_ref_doc_type_idx").using("btree", table.appRef.asc().nullsLast().op("text_ops"), table.docType.asc().nullsLast().op("enum_ops")),
	index("documents_app_ref_idx").using("btree", table.appRef.asc().nullsLast().op("text_ops")),
	index("documents_created_by_idx").using("btree", table.createdBy.asc().nullsLast().op("text_ops")),
	index("documents_doc_type_idx").using("btree", table.docType.asc().nullsLast().op("enum_ops")),
	index("documents_original_file_id_idx").using("btree", table.originalFileId.asc().nullsLast().op("text_ops")),
]);

export const aiVectorsInLc = lc.table("ai_vectors", {
	id: varchar({ length: 255 }).primaryKey().notNull(),
	appId: varchar("app_id", { length: 255 }).notNull(),
	docId: varchar("doc_id", { length: 255 }).notNull(),
	sourceType: varchar("source_type", { length: 50 }).default('document').notNull(),
	sectionId: varchar("section_id", { length: 255 }),
	hash: varchar({ length: 64 }),
	sessionId: varchar("session_id", { length: 255 }),
	knowledgeSetIds: text("knowledge_set_ids").array(),
	vector: vector({ dimensions: 1024 }).notNull(),
	content: text().notNull(),
	header: text(),
	metadata: jsonb().default({}).notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("ai_vectors_app_id_idx").using("btree", table.appId.asc().nullsLast().op("text_ops")),
	index("ai_vectors_content_tsv_idx").using("gin", sql`to_tsvector('chinese'::regconfig, content)`),
	index("ai_vectors_doc_id_idx").using("btree", table.docId.asc().nullsLast().op("text_ops")),
	index("ai_vectors_ks_idx").using("gin", table.knowledgeSetIds.asc().nullsLast().op("array_ops")),
	index("ai_vectors_section_id_idx").using("btree", table.sectionId.asc().nullsLast().op("text_ops")),
	index("ai_vectors_session_id_idx").using("btree", table.sessionId.asc().nullsLast().op("text_ops")),
]);

export const filesInLc = lc.table("files", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	name: text().notNull(),
	key: text().notNull(),
	mime: text(),
	size: integer(),
	refCount: integer("ref_count").default(0).notNull(),
	createdBy: text("created_by"),
	meta: jsonb().default({}),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).notNull(),
	provider: storageProviderInLc().default('local').notNull(),
	status: fileStatusInLc().default('available').notNull(),
	usageType: text("usage_type"),
	usageId: text("usage_id"),
});

export const userPropertiesInLc = lc.table("user_properties", {
	userId: varchar("user_id", { length: 255 }).notNull(),
	key: varchar({ length: 255 }).notNull(),
	value: jsonb(),
	metadata: jsonb().default({}),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow(),
}, (table) => [
	index("idx_user_props_userid").using("btree", table.userId.asc().nullsLast().op("text_ops")),
	primaryKey({ columns: [table.userId, table.key], name: "user_properties_user_id_key_pk"}),
]);

export const knowledgeSetItemsInLc = lc.table("knowledge_set_items", {
	knowledgeSetId: varchar("knowledge_set_id", { length: 255 }).notNull(),
	resourceId: varchar("resource_id", { length: 255 }).notNull(),
	appId: varchar("app_id", { length: 255 }).notNull(),
	syncStatus: varchar("sync_status", { length: 50 }).default('PENDING').notNull(),
	syncError: text("sync_error"),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("ks_items_app_id_idx").using("btree", table.appId.asc().nullsLast().op("text_ops")),
	index("ks_items_ks_id_idx").using("btree", table.knowledgeSetId.asc().nullsLast().op("text_ops")),
	index("ks_items_status_idx").using("btree", table.syncStatus.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.knowledgeSetId],
			foreignColumns: [knowledgeSetsInLc.id],
			name: "knowledge_set_items_knowledge_set_id_knowledge_sets_id_fk"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.resourceId],
			foreignColumns: [appResourcesInLc.id],
			name: "knowledge_set_items_resource_id_app_resources_id_fk"
		}).onDelete("cascade"),
	primaryKey({ columns: [table.knowledgeSetId, table.resourceId], name: "knowledge_set_items_knowledge_set_id_resource_id_pk"}),
]);
