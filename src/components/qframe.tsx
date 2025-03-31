import React from 'react';
import '../index.css';

const QFrame: React.FC = () => {
    /* REPLACE WITH YOUR Q BUSINESS DEPLOYED URL */
    const deployedUrl = "https://<YOUR_Q_BUSINESS_URL>.chat.qbusiness.us-east-1.on.aws/";

    return (
        <iframe
            src={deployedUrl}
            title="Chatbot"
            className="QFrame"
        />
    );
};

export default QFrame;