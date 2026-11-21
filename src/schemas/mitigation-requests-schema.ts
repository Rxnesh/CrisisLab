
import type { CollectionSchema } from "deepspace/schema";

export const mitigationRequestsSchema: CollectionSchema = {
  name: "mitigationRequests",

  columns: [
    {
      name: "incidentId",
      storage: "text",
      interpretation: "plain",
      required: true,
    },
    {
      name: "requestedBy",
      storage: "text",
      interpretation: "plain",
      required: true,
    },
    {
      name: "actionType",
      storage: "text",
      interpretation: "plain",
      required: true,
    },
    {
      name: "status",
      storage: "text",
      interpretation: "plain",
      required: true,
    },
    {
      name: "createdAt",
      storage: "text",
      interpretation: "plain",
      required: true,
    },
  ],

  permissions: {
    "*": {
      read: false,
      create: false,
      update: false,
      delete: false,
    },
    viewer: {
      read: false,
      create: false,
      update: false,
      delete: false,
    },
    member: {
      read: false,
      create: false,
      update: false,
      delete: false,
    },
    admin: {
      read: false,
      create: false,
      update: false,
      delete: false,
    },
  },
};
