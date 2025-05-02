import React from 'react';
import rawOutputs from '../../amplify_outputs.json';

const outputs = rawOutputs as unknown as {
    custom: {
        q_business_url: string;
    };
};

const QFrame: React.FC = () => {
    const qBusinessDeployedURL = outputs.custom.q_business_url;

    return (
        <iframe
            src={qBusinessDeployedURL}
            title="Chatbot"
            className="QFrame"
        />
    );
};

export default QFrame;