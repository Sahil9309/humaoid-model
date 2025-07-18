import React from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import UrdfUploader from "./pages/UrdfUploader.jsx"; // Adjust path if needed
import MobileCamera from "./pages/MobileCamera.jsx";

function App() {
  return (
    <>
      <Router>
        <Routes>
          <Route path="/" element={<UrdfUploader />} />
          <Route path="/mobile" element={<MobileCamera />} />
          {/* <Route path="/urdf-model" element={<UrdfUploader />} /> */}
        </Routes>
      </Router>
    </>
  );
}

export default App;
