import { Amplify } from 'aws-amplify';
import outputs from '../amplify_outputs.json';
import '@aws-amplify/ui-react/styles.css';
import { ThemeProvider, Authenticator, Button, Avatar } from '@aws-amplify/ui-react';
import { signOut } from 'aws-amplify/auth';
import QFrame from './components/qframe';
import { FileUploader } from '@aws-amplify/ui-react-storage';
import { useEffect, useState } from 'react';
import avatarImage from './assets/aq.jpg';

Amplify.configure(outputs);

function App() {
  const [showQiFrame, setShowQiFrame] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem('showQiFrame');
    if (saved === 'true') {
      setShowQiFrame(true);
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('showQiFrame', showQiFrame.toString());
  }, [showQiFrame]);

  const toggleQiFrame = () => {
    setShowQiFrame(!showQiFrame);
  };

  return (
    <ThemeProvider>
      <Authenticator>
        <div className="banner">
          <Button color="white" backgroundColor="darkolivegreen" onClick={() => signOut()}>Sign Out</Button>
        </div>
        <main>
          <div className="FileUploader">
            <FileUploader
              acceptedFileTypes={[
                '.pdf', '.html', '.xml', '.xslt', '.md', '.csv', '.xls', '.xlsx',
                '.json', '.rtf', '.ppt', '.pptx', '.doc', '.docx', '.txt'
              ]}
              path={({ identityId }) => `protected/${identityId}/`}
              maxFileCount={10}
              isResumable
            />
          </div>

          <Avatar
            src={avatarImage}
            size="large"
            alt="Q Assistant"
            onClick={toggleQiFrame}
            style={{
              position: 'fixed',
              bottom: '20px',
              right: '20px',
              cursor: 'pointer',
              zIndex: 1002,
            }}
          />

          <div className={`QiFrameContainer ${showQiFrame ? '' : 'hidden'}`}>
            <QFrame />
          </div>
        </main>
      </Authenticator>
    </ThemeProvider>
  );
}

export default App;
