import { defineStorage } from "@aws-amplify/backend";

export const storage = defineStorage({
    name: "q-datasource-bucket",
    access: (allow) => ({
        'protected/{entity_id}/*': [
            allow.authenticated.to(['read']),
            allow.entity('identity').to(['read', 'write', 'delete'])
        ]
    })
});