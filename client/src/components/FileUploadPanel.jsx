// src/components/FileUploadPanel.jsx
import React, { useRef, useCallback } from "react";

const FileUploadPanel = ({
  urdfFile,
  meshFiles,
  status,
  canvasError,
  loadingProgress,
  robotLoadRequested,
  onUrdfFileChange,
  onMeshFilesChange,
  onLoadRobot,
  onClearFiles,
  onStatusChange,
  onLoadingProgressChange,
}) => {
  const urdfInputRef = useRef(null);
  const meshesInputRef = useRef(null);

  const handleUrdfFileChange = useCallback(
    (event) => {
      const file = event.target.files[0];
      if (file && file.name.toLowerCase().endsWith(".urdf")) {
        onUrdfFileChange(file);
        onStatusChange(`URDF file selected: ${file.name}`);
      } else {
        onStatusChange("Please select a valid URDF file (.urdf extension).");
        onUrdfFileChange(null);
      }
    },
    [onUrdfFileChange, onStatusChange],
  );

  const handleMeshFilesChange = useCallback(
    async (event) => {
      const files = Array.from(event.target.files);
      const newMeshFiles = new Map();

      onStatusChange("Processing mesh files...");
      onLoadingProgressChange(0);

      try {
        for (let i = 0; i < files.length; i++) {
          const file = files[i];
          const validExtensions = [
            ".dae",
            ".stl",
            ".obj",
            ".ply",
            ".fbx",
            ".gltf",
            ".glb",
          ];
          const hasValidExtension = validExtensions.some((ext) =>
            file.name.toLowerCase().endsWith(ext),
          );

          if (!hasValidExtension) {
            continue;
          }

          try {
            const arrayBuffer = await file.arrayBuffer();
            newMeshFiles.set(file.name, arrayBuffer);
            onLoadingProgressChange(((i + 1) / files.length) * 100);
          } catch (fileError) {
            console.error(`Error processing file ${file.name}:`, fileError);
            continue;
          }
        }

        if (newMeshFiles.size === 0) {
          onStatusChange(
            "No valid mesh files found. Please select .dae, .stl, .obj, .ply, .fbx, .gltf, or .glb files.",
          );
          onMeshFilesChange(new Map());
          return;
        }

        onMeshFilesChange(newMeshFiles);
        onStatusChange(`${newMeshFiles.size} mesh files loaded successfully.`);
      } catch (error) {
        console.error("Error processing mesh files:", error);
        onStatusChange("Error processing mesh files. Please try again.");
        onMeshFilesChange(new Map());
      } finally {
        onLoadingProgressChange(0);
      }
    },
    [onMeshFilesChange, onStatusChange, onLoadingProgressChange],
  );

  const handleClearFiles = useCallback(() => {
    if (urdfInputRef.current) urdfInputRef.current.value = "";
    if (meshesInputRef.current) meshesInputRef.current.value = "";
    onClearFiles();
  }, [onClearFiles]);

  return (
    <div className="bg-gradient-to-b from-slate-800/40 to-slate-900/60 backdrop-blur-sm rounded-xl p-6 overflow-y-auto">
      <h2 className="text-2xl font-semibold mb-6 text-cyan-300">File Upload</h2>

      {/* URDF File Input */}
      <div className="mb-6">
        <label className="block text-sm font-medium mb-3 text-purple-300">
          URDF File (.urdf)
        </label>
        <input
          ref={urdfInputRef}
          type="file"
          accept=".urdf"
          onChange={handleUrdfFileChange}
          className="w-full p-3 bg-slate-800/50 border border-purple-500/30 rounded-xl text-white backdrop-blur-sm hover:border-cyan-400/50 transition-all duration-300 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-gradient-to-r file:from-purple-600 file:to-cyan-600 file:text-white hover:file:from-purple-700 hover:file:to-cyan-700"
        />
        {urdfFile && (
          <p className="mt-3 text-sm text-emerald-400 bg-emerald-900/20 p-2 rounded-lg">
            ✓ Selected: {urdfFile.name}
          </p>
        )}
      </div>

      {/* Mesh Files Input */}
      <div className="mb-6">
        <label className="block text-sm font-medium mb-3 text-purple-300">
          Mesh Files (.dae, .stl, .obj, etc.)
        </label>
        <input
          ref={meshesInputRef}
          type="file"
          multiple
          accept=".dae,.stl,.obj,.ply,.fbx,.gltf,.glb"
          onChange={handleMeshFilesChange}
          className="w-full p-3 bg-slate-800/50 border border-purple-500/30 rounded-xl text-white backdrop-blur-sm hover:border-cyan-400/50 transition-all duration-300 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-gradient-to-r file:from-purple-600 file:to-cyan-600 file:text-white hover:file:from-purple-700 hover:file:to-cyan-700"
        />
        {meshFiles.size > 0 && (
          <div className="mt-3 text-sm text-emerald-400 bg-emerald-900/20 p-3 rounded-lg">
            <p className="font-semibold">
              ✓ {meshFiles.size} mesh files loaded:
            </p>
            <ul className="list-disc list-inside ml-2 max-h-32 overflow-y-auto mt-2 space-y-1">
              {Array.from(meshFiles.keys()).map((filename) => (
                <li key={filename} className="text-xs text-emerald-300">
                  {filename}
                </li>
              ))}
            </ul>
          </div>
        )}
        {loadingProgress > 0 && loadingProgress < 100 && (
          <div className="mt-3">
            <div className="w-full bg-slate-700 rounded-full h-2.5">
              <div
                className="bg-cyan-500 h-2.5 rounded-full transition-all duration-300"
                style={{ width: `${loadingProgress}%` }}
              ></div>
            </div>
            <p className="text-xs text-slate-400 mt-1 text-right">
              Loading: {Math.round(loadingProgress)}%
            </p>
          </div>
        )}
      </div>

      {/* Action Buttons */}
      <div className="flex flex-col space-y-3 mb-6">
        <button
          onClick={onLoadRobot}
          disabled={!urdfFile || meshFiles.size === 0 || robotLoadRequested}
          className="w-full bg-gradient-to-r from-purple-600 to-cyan-600 hover:from-purple-700 hover:to-cyan-700 disabled:from-slate-600 disabled:to-slate-700 disabled:cursor-not-allowed px-6 py-3 rounded-xl font-semibold transition-all duration-300 transform hover:scale-105 disabled:hover:scale-100 shadow-lg hover:shadow-purple-500/25"
        >
          {robotLoadRequested ? "Loading..." : "Load Robot"}
        </button>
        <button
          onClick={handleClearFiles}
          className="w-full bg-gradient-to-r from-red-600 to-pink-600 hover:from-red-700 hover:to-pink-700 px-6 py-3 rounded-xl font-semibold transition-all duration-300 transform hover:scale-105 shadow-lg hover:shadow-red-500/25"
        >
          Clear Files
        </button>
      </div>

      {/* Status Display */}
      <div
        className={`backdrop-blur-sm rounded-xl p-4 border mb-6 ${
          canvasError
            ? "bg-red-800/50 border-red-500/30 text-red-300"
            : "bg-slate-800/50 border-purple-500/20"
        }`}
      >
        <p
          className={`text-sm ${
            canvasError ? "text-red-300" : "text-cyan-300"
          }`}
        >
          {canvasError || status}
        </p>
      </div>

      {/* Body Controls Info */}
      <div className="bg-gradient-to-br from-purple-800/20 to-cyan-800/20 backdrop-blur-sm rounded-xl p-4 border border-purple-500/20">
        <h3 className="text-sm font-semibold mb-3 text-purple-300">
          Body Controls:
        </h3>
        <ul className="text-xs space-y-2 text-slate-300">
          <li className="flex items-center space-x-2">
            <span className="w-2 h-2 bg-blue-400 rounded-full"></span>
            <span>Head position controls robot head</span>
          </li>
          <li className="flex items-center space-x-2">
            <span className="w-2 h-2 bg-red-400 rounded-full"></span>
            <span>Left hand controls left arm</span>
          </li>
          <li className="flex items-center space-x-2">
            <span className="w-2 h-2 bg-green-400 rounded-full"></span>
            <span>Right hand controls right arm</span>
          </li>
          <li className="flex items-center space-x-2">
            <span className="w-2 h-2 bg-purple-400 rounded-full"></span>
            <span>Body position controls legs</span>
          </li>
        </ul>
      </div>
    </div>
  );
};

export default FileUploadPanel;
