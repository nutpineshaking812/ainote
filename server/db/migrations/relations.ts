import { relations } from "drizzle-orm/relations";
import { knowledgeSetsInLc, knowledgeSetItemsInLc, appResourcesInLc } from "./schema";

export const knowledgeSetItemsInLcRelations = relations(knowledgeSetItemsInLc, ({one}) => ({
	knowledgeSetsInLc: one(knowledgeSetsInLc, {
		fields: [knowledgeSetItemsInLc.knowledgeSetId],
		references: [knowledgeSetsInLc.id]
	}),
	appResourcesInLc: one(appResourcesInLc, {
		fields: [knowledgeSetItemsInLc.resourceId],
		references: [appResourcesInLc.id]
	}),
}));

export const knowledgeSetsInLcRelations = relations(knowledgeSetsInLc, ({many}) => ({
	knowledgeSetItemsInLcs: many(knowledgeSetItemsInLc),
}));

export const appResourcesInLcRelations = relations(appResourcesInLc, ({many}) => ({
	knowledgeSetItemsInLcs: many(knowledgeSetItemsInLc),
}));