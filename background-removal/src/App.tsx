import { Effect, Engine } from "@rendley/sdk";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { BackgroundRemovalShader } from "./BackgroundRemovalShader";
import { hexToVec3, vec3ToHex } from "./utils";

const App = () => {
  const [isLoading, setLoading] = useState(true);
  const [isPlaying, setPlaying] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const effectRef = useRef<Effect | null>(null);

  const init = useCallback(async () => {
    if (canvasRef.current == null) {
      return;
    }

    if (Engine.getInstance().isInitialized()) {
      return;
    }

    await Engine.getInstance().init({
      display: {
        width: 1920,
        height: 1080,
        backgroundColor: "#000000",
        view: canvasRef.current,
      },
      license: {
        licenseName: "",
        licenseKey: "",
      },
    });

    const engine = Engine.getInstance();

    const mediaId = await engine.getLibrary().addMedia("/scene.mp4");

    if (mediaId == null) {
      alert("Error adding media");
      return;
    }

    const layer = engine.getTimeline().createLayer();

    const clip = await layer.addClip({
      mediaDataId: mediaId,
      startTime: 0,
    });

    if (clip == null) {
      alert("Error adding clip");
      return;
    }

    effectRef.current = new Effect({
      sourceId: "BackgroundRemovalShader",
      fragmentSrc: BackgroundRemovalShader,
      textureWidth: clip.sprite.texture.width,
      textureHeight: clip.sprite.texture.height,
      frameWidth: clip.sprite.width / clip.sprite.scale.x,
      frameHeight: clip.sprite.height / clip.sprite.scale.y,
      uniforms: {
        keyColor: [0.27, 0.7, 0.34],
        similarity: 0.1,
        smoothness: 0.1,
        spill: 0.25,
      },
    });

    clip.addEffect(effectRef.current);

    setLoading(false);
  }, [canvasRef.current]);

  useEffect(() => {
    init();
  }, [init]);

  const handleChangeUniform = (name: string, value: unknown) => {
    if (effectRef.current == null) {
      return;
    }

    effectRef.current.getPixiFilter().uniforms[name] = value;
  };

  const handleReplaceMedia = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];

    if (file == null) {
      return;
    }

    const library = Engine.getInstance().getLibrary();
    const timeline = Engine.getInstance().getTimeline();

    Object.keys(library.media).forEach((mediaId) => {
      library.deleteMedia(mediaId);
    });

    Object.keys(timeline.getClips()).forEach((clipId) => {
      timeline.removeClip(clipId);
    });

    const layerId = timeline.layersOrder[0];

    if (layerId == null) {
      alert("No layer found");
      return;
    }

    const mediaDataId = await library.addMedia(file);

    if (mediaDataId == null) {
      alert("Error adding media");
      return;
    }

    const layer = timeline.getLayerById(layerId);

    const clip = await layer?.addClip({
      mediaDataId,
      startTime: 0,
    });

    if (clip == null) {
      alert("Error adding clip");
      return;
    }

    if (effectRef.current == null) {
      alert("Effect not initialized");
      return;
    }

    clip.addEffect(effectRef.current);
  };

  const handlePlay = () => {
    Engine.getInstance().play();
    setPlaying(true);
  };

  const handlePause = () => {
    Engine.getInstance().pause();
    setPlaying(false);
  };

  const renderControlInput = (name: string, label: string) => {
    return (
      <>
        <td>
          <input
            type="range"
            name={name}
            defaultValue={
              effectRef.current?.getPixiFilter().uniforms[name] ?? 0
            }
            min={0}
            max={1}
            step={0.01}
            onChange={(e) =>
              handleChangeUniform(e.target.name, parseFloat(e.target.value))
            }
          />
        </td>

        <td>
          <label htmlFor={name}>{label}</label>
        </td>
      </>
    );
  };

  return (
    <div className="container">
      {isLoading && <h2>Loading...</h2>}

      {!isLoading && (
        <table>
          <tbody>
            <tr>
              <td>
                <input type="file" onChange={handleReplaceMedia} />
              </td>
              <td>
                <label htmlFor="file">Upload file</label>
              </td>
            </tr>
            <tr>
              <td>
                <input
                  type="color"
                  name="backgroundColor"
                  defaultValue={Engine.getInstance()
                    .getDisplay()
                    .getBackgroundColor()}
                  onChange={(e) =>
                    Engine.getInstance()
                      .getDisplay()
                      .setBackgroundColor(e.target.value)
                  }
                />
              </td>
              <td>
                <label htmlFor="backgroundColor">Background Color</label>
              </td>
            </tr>
            <tr>
              <td>
                <input
                  type="color"
                  name="keyColor"
                  defaultValue={vec3ToHex(
                    effectRef.current?.getPixiFilter().uniforms.keyColor
                  )}
                  onChange={(e) =>
                    handleChangeUniform(
                      e.target.name,
                      hexToVec3(e.target.value)
                    )
                  }
                />
              </td>
              <td>
                <label htmlFor="keyColor">Key Color</label>
              </td>
            </tr>
            <tr>{renderControlInput("similarity", "Similarity")}</tr>
            <tr>{renderControlInput("smoothness", "Smoothness")}</tr>
            <tr>{renderControlInput("spill", "Spill")}</tr>
          </tbody>
        </table>
      )}

      <canvas id="engine" ref={canvasRef} />

      {!isLoading && (
        <div>
          {isPlaying ? (
            <button onClick={handlePause}>Pause</button>
          ) : (
            <button onClick={handlePlay}>Play</button>
          )}
        </div>
      )}
    </div>
  );
};

export default App;
