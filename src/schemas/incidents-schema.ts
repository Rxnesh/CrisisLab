
import type { CollectionSchema } from "deepspace/schema";

export const incidentsSchema: CollectionSchema = {
  name: "incidents",

  columns: [
    {
       name: "ownerId",
  storage: "text",
  interpretation: "plain",
  required: true,
    },
    {  
      name: "title",
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
      name: "scenario",
      storage: "text",
      interpretation: { kind: "json" },
      required: true,
    },
    {
      name: "state",
      storage: "text",
      interpretation: { kind: "json" },
      required: true,
    },
    {
      name: "lastTick",
      storage: "number",
      interpretation: "plain",
    },

    {
  name: "roomCode",
  storage: "text",
  interpretation: "plain",
},
{
  name: "memberIds",
  storage: "text",
  interpretation: { kind: "json" },
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
