import { defineStorage } from "@aws-amplify/backend";

export const storage = defineStorage({
    name: "q-datasource-bucket",
    access: (allow) => ({
        'public/*': [
            allow.authenticated.to(['read', 'write', 'delete'])
        ]
    })
});