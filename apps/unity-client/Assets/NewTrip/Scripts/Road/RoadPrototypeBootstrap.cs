using UnityEngine;

namespace NewTrip.Client.Road
{
    public enum RoadPrototypeVisualMode
    {
        PlaceholderOnly,
        ImportedPrototypeAssets
    }

    public sealed class RoadPrototypeBootstrap : MonoBehaviour
    {
        private const float RenderWidth = 5.625f;
        private const float RenderHeight = 10f;

        public bool buildOnAwake = true;
        public RoadPrototypeVisualMode visualMode = RoadPrototypeVisualMode.PlaceholderOnly;
        public RoadVisualSegmentKey activeSegment = RoadVisualSegmentKey.CoastalCliffsSunset;
        public RoadProjectionPreset projectionPreset = RoadProjectionPreset.BigSurPrototype;
        public bool showDebugOverlay = true;
        public bool enableFarBackgroundLayer;
        public bool enableRoadsideSpawner;
        public bool enableSignSpawner;
        public bool enableWeatherOverlay;

        private void Awake()
        {
            if (Application.isPlaying && buildOnAwake)
            {
                BuildPrototype();
            }
        }

        private void Start()
        {
            if (Application.isPlaying && buildOnAwake && transform.Find("RoadSceneRoot") == null)
            {
                BuildPrototype();
            }
        }

        public void BuildPrototype()
        {
            ClearExistingRoot();
            Camera camera = EnsureCamera();

            GameObject root = CreateChild(gameObject, "RoadSceneRoot");
            root.transform.localPosition = Vector3.zero;

            GameObject motionObject = CreateChild(root, "RoadMotionState");
            RoadMotionState motionState = motionObject.AddComponent<RoadMotionState>();
            motionState.serverSpeedKmph = 72f;
            motionState.visualSpeedMultiplier = 1f;

            Vector2 centerPivot = new Vector2(0.5f, 0.5f);
            Vector2 bottomCenterPivot = new Vector2(0.5f, 0f);

            Sprite skySprite = LoadSpriteForMode("sky_sunset", CreateSkyTexture(), 160f, centerPivot);
            Sprite farSprite = LoadSpriteForMode("far_coast_cutout", CreateFarBackgroundTexture(), 160f, centerPivot);
            Sprite bridgeSprite = LoadSpriteForMode("bridge_midground_cutout", CreateFarBackgroundTexture(), 160f, centerPivot);
            Sprite carSprite = LoadSpriteForMode("car_rear_player", CreateCarTexture(), visualMode == RoadPrototypeVisualMode.PlaceholderOnly ? 48f : 256f, bottomCenterPivot);
            Sprite rockSprite = LoadSpriteForMode("roadside_rock", CreateRockTexture(), 128f, bottomCenterPivot);
            Sprite bushSprite = LoadSpriteForMode("roadside_bush_flowers", CreatePineTexture(), 128f, bottomCenterPivot);
            Sprite cliffSprite = LoadSpriteForMode("roadside_cliff_edge", CreateRockTexture(), 128f, bottomCenterPivot);
            Sprite pineSprite = LoadSpriteForMode("roadside_pine", CreatePineTexture(), 128f, bottomCenterPivot);
            Sprite guardrailSprite = LoadSpriteForMode("roadside_guardrail", CreateGuardrailTexture(), 128f, bottomCenterPivot);
            Sprite signSprite = LoadSpriteForMode("sign_scenic_overlook", CreateSignTexture(), 128f, bottomCenterPivot);
            Sprite bigSurSignSprite = LoadSpriteForMode("sign_big_sur_15", CreateSignTexture(), 128f, bottomCenterPivot);
            Sprite restStopSignSprite = LoadSpriteForMode("sign_rest_stop", CreateSignTexture(), 128f, bottomCenterPivot);
            Sprite woodArrowSignSprite = LoadSpriteForMode("sign_wood_arrow", CreateSignTexture(), 128f, bottomCenterPivot);
            Sprite hazeSprite = LoadSpriteForMode("weather_haze_clouds", CreateHazeTexture(), 192f, centerPivot);
            Sprite rainSprite = LoadSpriteForMode("weather_rain_streaks", CreateRainTexture(), 192f, centerPivot);
            Sprite fogSprite = LoadSpriteForMode("weather_sun_glow", CreateFogTexture(), 192f, centerPivot);

            Material roadMaterial = CreateMaterial(
                "PrototypeRoadMaterial",
                LoadTextureForMode("road_asphalt_runtime_tile_512", CreateRoadTexture(), TextureWrapMode.Repeat),
                true
            );
            Material shoulderMaterial = CreateMaterial(
                "PrototypeShoulderMaterial",
                LoadTextureForMode("dirt_shoulder_strip", CreateShoulderTexture(), TextureWrapMode.Repeat),
                true
            );
            Material laneMaterial = CreateMaterial(
                "PrototypeLaneMaterial",
                LoadTextureForMode("lane_yellow_single_runtime_strip", CreateLaneTexture(), TextureWrapMode.Repeat),
                true
            );
            LogTexture("Prototype road", roadMaterial);
            LogTexture("Prototype shoulder", shoulderMaterial);
            LogTexture("Prototype lane", laneMaterial);

            GameObject roadObject = CreateChild(root, "RoadMesh");
            Pseudo3DRoadRenderer roadRenderer = roadObject.AddComponent<Pseudo3DRoadRenderer>();
            roadRenderer.motionState = motionState;
            roadRenderer.renderWidth = RenderWidth;
            roadRenderer.renderHeight = RenderHeight;
            roadRenderer.projectionPreset = projectionPreset;
            roadRenderer.applyProjectionPresetOnRebuild = true;
            roadRenderer.textureUMin = 0f;
            roadRenderer.textureUMax = 1f;
            roadRenderer.useWidthBasedTextureU = true;
            roadRenderer.asphaltTileWorldWidth = 1.45f;
            roadRenderer.textureRepeat = 3.8f;
            roadRenderer.textureMetersPerRepeat = 44f;
            roadRenderer.useDepthAwareMotion = true;
            roadRenderer.horizonFadeStartDepth = 0.58f;
            roadRenderer.horizonAlpha = 0.035f;
            roadRenderer.farTint = new Color(0.58f, 0.53f, 0.48f, 1f);
            roadRenderer.SetMaterial(roadMaterial);
            SetRendererOrder(roadObject, 10);
            roadRenderer.RebuildMesh();

            GameObject shoulderObject = CreateChild(root, "RoadShoulders");
            RoadShoulderRenderer shoulderRenderer = shoulderObject.AddComponent<RoadShoulderRenderer>();
            shoulderRenderer.roadRenderer = roadRenderer;
            shoulderRenderer.motionState = motionState;
            shoulderRenderer.textureMetersPerRepeat = 16f;
            shoulderRenderer.SetMaterial(shoulderMaterial);
            SetRendererOrder(shoulderObject, 8);
            shoulderRenderer.RebuildMesh();

            GameObject skyLayer = CreateChild(root, "SkyLayer");
            SpriteRenderer skyRenderer = skyLayer.AddComponent<SpriteRenderer>();
            skyRenderer.sprite = skySprite;

            GameObject farLayer = CreateChild(root, "FarBackgroundLayer");
            SpriteRenderer farRenderer = farLayer.AddComponent<SpriteRenderer>();
            farRenderer.sprite = farSprite;

            GameObject bridgeLayer = CreateChild(root, "BridgeMidgroundLayer");
            SpriteRenderer bridgeRenderer = bridgeLayer.AddComponent<SpriteRenderer>();
            bridgeRenderer.sprite = bridgeSprite;

            GameObject backgroundObject = CreateChild(root, "RoadBackground");
            RoadBackgroundController backgroundController = backgroundObject.AddComponent<RoadBackgroundController>();
            backgroundController.roadRenderer = roadRenderer;
            backgroundController.targetCamera = camera;
            backgroundController.skyLayer = skyRenderer;
            backgroundController.farBackgroundLayer = farRenderer;
            backgroundController.midgroundLandmarkLayer = bridgeRenderer;
            backgroundController.activeSegment = activeSegment;
            backgroundController.enforceDrivingLayerPolicy = true;
            backgroundController.showFarBackground = enableFarBackgroundLayer || visualMode == RoadPrototypeVisualMode.ImportedPrototypeAssets;
            backgroundController.showMidgroundLandmark = visualMode == RoadPrototypeVisualMode.ImportedPrototypeAssets && activeSegment == RoadVisualSegmentKey.BridgeCoastNight;
            backgroundController.farTint = new Color(1f, 1f, 1f, 0.78f);
            backgroundController.ApplyLayout();

            LaneMarkingRenderer leftLaneRenderer = CreateProjectedYellowLine(
                root,
                "LaneYellowLeftMesh",
                roadRenderer,
                motionState,
                laneMaterial,
                side: -1
            );
            CreateProjectedYellowLine(
                root,
                "LaneYellowRightMesh",
                roadRenderer,
                motionState,
                laneMaterial,
                side: 1
            );

            GameObject sideRoot = CreateChild(root, "SideObjectRoot");
            GameObject sideSpawnerObject = CreateChild(root, "SideObjectSpawner");
            SideObjectSpawner sideSpawner = sideSpawnerObject.AddComponent<SideObjectSpawner>();
            sideSpawner.roadRenderer = roadRenderer;
            sideSpawner.motionState = motionState;
            sideSpawner.objectRoot = sideRoot.transform;
            sideSpawner.profile = CreateRoadsideProfile(rockSprite, bushSprite, cliffSprite, pineSprite, guardrailSprite);
            sideSpawner.useDistanceBasedMotion = true;
            sideSpawner.seedInitialDistanceWindow = true;
            sideSpawner.enabled = enableRoadsideSpawner;

            GameObject signRoot = CreateChild(root, "LandmarkSignRoot");
            GameObject signSpawnerObject = CreateChild(root, "LandmarkSignSpawner");
            LandmarkSignSpawner signSpawner = signSpawnerObject.AddComponent<LandmarkSignSpawner>();
            signSpawner.roadRenderer = roadRenderer;
            signSpawner.signRoot = signRoot.transform;
            signSpawner.placeholderSignSprite = signSprite;
            signSpawner.signSprites = new[] { signSprite, bigSurSignSprite, restStopSignSprite, woodArrowSignSprite };
            signSpawner.enabled = enableSignSpawner;

            GameObject weatherObject = CreateChild(root, "WeatherOverlay");
            SpriteRenderer weatherRenderer = weatherObject.AddComponent<SpriteRenderer>();
            weatherRenderer.sortingOrder = 60;
            WeatherOverlayRenderer weatherOverlay = weatherObject.AddComponent<WeatherOverlayRenderer>();
            weatherOverlay.roadRenderer = roadRenderer;
            weatherOverlay.overlayRenderer = weatherRenderer;
            weatherOverlay.hazeSprite = hazeSprite;
            weatherOverlay.rainSprite = rainSprite;
            weatherOverlay.fogSprite = fogSprite;
            weatherOverlay.SetWeather(enableWeatherOverlay ? "haze" : "clear");

            GameObject carObject = CreateChild(root, "PlayerCar");
            SpriteRenderer carRenderer = carObject.AddComponent<SpriteRenderer>();
            carRenderer.sprite = carSprite;
            carRenderer.sortingOrder = 50;
            CarRearController carController = carObject.AddComponent<CarRearController>();
            carController.roadRenderer = roadRenderer;
            carController.anchorViewport = new Vector2(0.5f, 0.105f);
            carController.baseScale = visualMode == RoadPrototypeVisualMode.PlaceholderOnly ? 1.05f : 0.74f;

            GameObject controllerObject = CreateChild(root, "RoadSceneController");
            RoadSceneController sceneController = controllerObject.AddComponent<RoadSceneController>();
            sceneController.motionState = motionState;
            sceneController.roadRenderer = roadRenderer;
            sceneController.laneMarkingRenderer = leftLaneRenderer;
            sceneController.carRearController = carController;
            sceneController.sideObjectSpawner = sideSpawner;
            sceneController.landmarkSignSpawner = signSpawner;
            sceneController.weatherOverlayRenderer = weatherOverlay;
            sceneController.autoSpawnDemoSigns = enableSignSpawner;
            sceneController.initialWeatherKey = enableWeatherOverlay ? "haze" : "clear";
            sceneController.spawnForcedStopSignOnServerState = enableSignSpawner;

            GameObject adapterObject = CreateChild(root, "TripVisualStateAdapter");
            TripVisualStateAdapter adapter = adapterObject.AddComponent<TripVisualStateAdapter>();
            adapter.sceneController = sceneController;

            CreateChild(root, "HudRoot");

            GameObject debugObject = CreateChild(root, "RoadDebugOverlay");
            RoadDebugOverlay debugOverlay = debugObject.AddComponent<RoadDebugOverlay>();
            debugOverlay.roadRenderer = roadRenderer;
            debugOverlay.showGuides = showDebugOverlay;
            debugOverlay.carAnchorViewport = carController.anchorViewport;

            camera.transform.position = new Vector3(0f, 0f, -10f);
            camera.transform.rotation = Quaternion.identity;

            RoadPortraitCameraController cameraController = camera.GetComponent<RoadPortraitCameraController>();

            if (cameraController == null)
            {
                cameraController = camera.gameObject.AddComponent<RoadPortraitCameraController>();
            }

            cameraController.targetWidth = RenderWidth;
            cameraController.targetHeight = RenderHeight;
            cameraController.clearColor = Color.black;
            cameraController.Apply();
        }

        private static void SetRendererOrder(GameObject target, int sortingOrder)
        {
            Renderer renderer = target.GetComponent<Renderer>();

            if (renderer != null)
            {
                renderer.sortingOrder = sortingOrder;
            }
        }

        private static LaneMarkingRenderer CreateProjectedYellowLine(
            GameObject root,
            string objectName,
            Pseudo3DRoadRenderer roadRenderer,
            RoadMotionState motionState,
            Material material,
            int side
        )
        {
            GameObject laneObject = CreateChild(root, objectName);
            LaneMarkingRenderer laneRenderer = laneObject.AddComponent<LaneMarkingRenderer>();
            laneRenderer.roadRenderer = roadRenderer;
            laneRenderer.motionState = motionState;
            laneRenderer.sliceCount = 72;
            laneRenderer.useRoadRelativeWidth = false;
            laneRenderer.useDepthViewportWidth = true;
            laneRenderer.nearLaneHalfWidthViewport = 0.0078f;
            laneRenderer.farLaneHalfWidthViewport = 0.0008f;
            laneRenderer.widthDepthCurve = 1f;
            laneRenderer.minLaneHalfWidth = 0.0025f;
            laneRenderer.useDepthViewportCenterOffset = true;
            laneRenderer.nearCenterOffsetViewport = side * 0.014f;
            laneRenderer.farCenterOffsetViewport = side * 0.0017f;
            laneRenderer.centerOffsetDepthCurve = 1f;
            laneRenderer.textureUMin = 0f;
            laneRenderer.textureUMax = 1f;
            laneRenderer.textureRepeat = 12.5f;
            laneRenderer.textureMetersPerRepeat = 18f;
            laneRenderer.useDepthAwareMotion = true;
            laneRenderer.useHorizonFade = true;
            laneRenderer.horizonFadeStartDepth = 0.58f;
            laneRenderer.horizonAlpha = 0.015f;
            laneRenderer.farTint = new Color(1f, 0.76f, 0.48f, 1f);
            laneRenderer.SetMaterial(material);
            SetRendererOrder(laneObject, 20);
            laneRenderer.RebuildMesh();
            return laneRenderer;
        }

        private Camera EnsureCamera()
        {
            Camera camera = Camera.main;

            if (camera == null)
            {
                GameObject cameraObject = new GameObject("Main Camera");
                camera = cameraObject.AddComponent<Camera>();
                cameraObject.tag = "MainCamera";
            }

            return camera;
        }

        private RoadsideSpawnProfile CreateRoadsideProfile(Sprite rockSprite, Sprite bushSprite, Sprite cliffSprite, Sprite pineSprite, Sprite guardrailSprite)
        {
            RoadsideSpawnProfile profile = ScriptableObject.CreateInstance<RoadsideSpawnProfile>();
            ApplyHideFlags(profile);

            profile.spawnIntervalSeconds = new Vector2(0.16f, 0.42f);
            profile.spawnSpacingMeters = new Vector2(8f, 18f);
            profile.depthTravelMeters = 58f;
            profile.depthMoveRate = 0.34f;
            profile.entries.Add(new RoadsideSpawnEntry
            {
                spriteId = "left_cliff_rock",
                sprite = rockSprite,
                tint = Color.white,
                side = RoadsideSide.Left,
                laneOffset = 0.16f,
                nearScale = 1.35f,
                farScale = 0.14f,
                parallaxSpeed = 1.05f,
                rarityWeight = 1.4f
            });
            profile.entries.Add(new RoadsideSpawnEntry
            {
                spriteId = "left_cliff_edge",
                sprite = cliffSprite,
                tint = Color.white,
                side = RoadsideSide.Left,
                laneOffset = 0.2f,
                nearScale = 1.25f,
                farScale = 0.1f,
                parallaxSpeed = 1f,
                rarityWeight = 0.9f
            });
            profile.entries.Add(new RoadsideSpawnEntry
            {
                spriteId = "coastal_flower_bush",
                sprite = bushSprite,
                tint = Color.white,
                side = RoadsideSide.Left,
                laneOffset = 0.42f,
                nearScale = 0.92f,
                farScale = 0.12f,
                parallaxSpeed = 0.92f,
                rarityWeight = 1.2f
            });
            profile.entries.Add(new RoadsideSpawnEntry
            {
                spriteId = "coastal_pine",
                sprite = pineSprite,
                tint = Color.white,
                side = RoadsideSide.Right,
                laneOffset = 0.36f,
                nearScale = 1.45f,
                farScale = 0.11f,
                parallaxSpeed = 0.92f,
                rarityWeight = 0.8f
            });
            profile.entries.Add(new RoadsideSpawnEntry
            {
                spriteId = "right_guardrail",
                sprite = guardrailSprite,
                tint = Color.white,
                side = RoadsideSide.Right,
                laneOffset = 0.1f,
                nearScale = 1.2f,
                farScale = 0.12f,
                parallaxSpeed = 1.15f,
                rarityWeight = 1.5f
            });

            return profile;
        }

        private Material CreateMaterial(string materialName, Texture2D texture, bool transparent)
        {
            Shader shader = Shader.Find("Sprites/Default");

            if (shader == null)
            {
                shader = Shader.Find(transparent ? "Unlit/Transparent" : "Unlit/Texture");
            }

            Material material = new Material(shader)
            {
                name = materialName,
                mainTexture = texture
            };
            material.SetColor("_Color", Color.white);
            material.SetInt("_Cull", (int)UnityEngine.Rendering.CullMode.Off);
            ApplyHideFlags(material);

            return material;
        }

        private static void LogTexture(string label, Material material)
        {
            Texture texture = material != null ? material.mainTexture : null;

            if (texture == null)
            {
                Debug.LogWarning(label + " texture loaded: <missing>");
                return;
            }

            Debug.Log(
                label + " texture loaded: " +
                texture.name + ", " +
                texture.width + "x" + texture.height + ", " +
                "wrap=" + texture.wrapMode + ", " +
                "filter=" + texture.filterMode
            );
        }

        private Sprite LoadSpriteForMode(string resourceName, Texture2D placeholder, float pixelsPerUnit, Vector2 pivot)
        {
            if (visualMode == RoadPrototypeVisualMode.ImportedPrototypeAssets)
            {
                return PrototypeCompositeAssets.LoadSprite(resourceName, placeholder, pixelsPerUnit, TextureWrapMode.Clamp, pivot);
            }

            return CreateSprite(resourceName + "_placeholder", placeholder, pixelsPerUnit, pivot);
        }

        private Texture2D LoadTextureForMode(string resourceName, Texture2D placeholder, TextureWrapMode wrapMode)
        {
            if (visualMode == RoadPrototypeVisualMode.ImportedPrototypeAssets)
            {
                return PrototypeCompositeAssets.LoadTexture(resourceName, placeholder, wrapMode);
            }

            placeholder.wrapMode = wrapMode;
            return placeholder;
        }

        private Sprite CreateSprite(string spriteName, Texture2D texture, float pixelsPerUnit, Vector2 pivot)
        {
            Sprite sprite = Sprite.Create(
                texture,
                new Rect(0f, 0f, texture.width, texture.height),
                pivot,
                pixelsPerUnit
            );
            sprite.name = spriteName;
            ApplyHideFlags(sprite);
            return sprite;
        }

        private static GameObject CreateChild(GameObject parent, string childName)
        {
            GameObject child = new GameObject(childName);
            child.transform.SetParent(parent.transform, false);
            ApplyHideFlags(child);
            return child;
        }

        private void ClearExistingRoot()
        {
            Transform existing = transform.Find("RoadSceneRoot");

            if (existing == null)
            {
                return;
            }

            if (Application.isPlaying)
            {
                Destroy(existing.gameObject);
            }
            else
            {
                DestroyImmediate(existing.gameObject);
            }
        }

        private static void ApplyHideFlags(Object target)
        {
            if (target != null && !Application.isPlaying)
            {
                target.hideFlags = HideFlags.DontSaveInEditor;
            }
        }

        private static Texture2D CreateRoadTexture()
        {
            Texture2D texture = NewTexture("PrototypeRoadAsphaltTile", 64, 64, TextureWrapMode.Repeat);

            for (int y = 0; y < texture.height; y++)
            {
                for (int x = 0; x < texture.width; x++)
                {
                    float noise = ((x * 17 + y * 29) % 13) / 13f;
                    Color color = Color.Lerp(new Color(0.18f, 0.17f, 0.18f), new Color(0.32f, 0.29f, 0.27f), noise);
                    texture.SetPixel(x, y, color);
                }
            }

            texture.Apply();
            return texture;
        }

        private static Texture2D CreateLaneTexture()
        {
            Texture2D texture = NewTexture("PrototypeLaneStrip", 16, 64, TextureWrapMode.Repeat);
            Color clear = new Color(1f, 1f, 1f, 0f);

            for (int y = 0; y < texture.height; y++)
            {
                for (int x = 0; x < texture.width; x++)
                {
                    bool dash = y % 32 < 18;
                    bool stripe = x >= 6 && x <= 9;
                    texture.SetPixel(x, y, dash && stripe ? new Color(1f, 0.86f, 0.56f, 0.92f) : clear);
                }
            }

            texture.Apply();
            return texture;
        }

        private static Texture2D CreateShoulderTexture()
        {
            Texture2D texture = NewTexture("PrototypeShoulderTexture", 32, 64, TextureWrapMode.Repeat);

            for (int y = 0; y < texture.height; y++)
            {
                for (int x = 0; x < texture.width; x++)
                {
                    float noise = ((x * 11 + y * 23) % 17) / 17f;
                    Color color = Color.Lerp(new Color(0.34f, 0.21f, 0.14f, 0.92f), new Color(0.52f, 0.34f, 0.2f, 0.96f), noise);
                    texture.SetPixel(x, y, color);
                }
            }

            texture.Apply();
            return texture;
        }

        private static Texture2D CreateSkyTexture()
        {
            Texture2D texture = NewTexture("PrototypeSkySunsetTexture", 32, 96, TextureWrapMode.Clamp);

            for (int y = 0; y < texture.height; y++)
            {
                float t = y / (float)(texture.height - 1);
                Color bottom = new Color(1f, 0.54f, 0.31f);
                Color top = new Color(0.35f, 0.22f, 0.48f);
                Color color = Color.Lerp(bottom, top, t);

                for (int x = 0; x < texture.width; x++)
                {
                    texture.SetPixel(x, y, color);
                }
            }

            texture.Apply();
            return texture;
        }

        private static Texture2D CreateFarBackgroundTexture()
        {
            Texture2D texture = NewTexture("PrototypeFarCliffsTexture", 128, 48, TextureWrapMode.Clamp);
            Color clear = new Color(0f, 0f, 0f, 0f);
            Color cliff = new Color(0.22f, 0.18f, 0.26f, 0.92f);
            Color ocean = new Color(0.23f, 0.34f, 0.44f, 0.82f);

            for (int y = 0; y < texture.height; y++)
            {
                for (int x = 0; x < texture.width; x++)
                {
                    int ridge = 12 + Mathf.FloorToInt(8f * Mathf.Sin(x * 0.08f) + 5f * Mathf.Sin(x * 0.19f));

                    if (y < 12)
                    {
                        texture.SetPixel(x, y, ocean);
                    }
                    else if (y < 16 + ridge)
                    {
                        texture.SetPixel(x, y, cliff);
                    }
                    else
                    {
                        texture.SetPixel(x, y, clear);
                    }
                }
            }

            texture.Apply();
            return texture;
        }

        private static Texture2D CreateCarTexture()
        {
            Texture2D texture = NewTexture("PrototypeRearCarTexture", 48, 32, TextureWrapMode.Clamp);
            Fill(texture, new Color(0f, 0f, 0f, 0f));

            DrawRect(texture, 9, 10, 30, 13, new Color(0.12f, 0.28f, 0.42f, 1f));
            DrawRect(texture, 13, 18, 22, 8, new Color(0.1f, 0.22f, 0.34f, 1f));
            DrawRect(texture, 15, 20, 18, 4, new Color(0.52f, 0.78f, 0.9f, 1f));
            DrawRect(texture, 7, 8, 8, 6, new Color(0.04f, 0.04f, 0.05f, 1f));
            DrawRect(texture, 33, 8, 8, 6, new Color(0.04f, 0.04f, 0.05f, 1f));
            DrawRect(texture, 10, 13, 5, 4, new Color(1f, 0.26f, 0.18f, 1f));
            DrawRect(texture, 33, 13, 5, 4, new Color(1f, 0.26f, 0.18f, 1f));

            texture.Apply();
            return texture;
        }

        private static Texture2D CreateRockTexture()
        {
            Texture2D texture = NewTexture("PrototypeRockTexture", 32, 26, TextureWrapMode.Clamp);
            Fill(texture, new Color(0f, 0f, 0f, 0f));
            DrawRect(texture, 6, 4, 20, 8, new Color(0.37f, 0.28f, 0.24f, 1f));
            DrawRect(texture, 9, 10, 15, 7, new Color(0.48f, 0.35f, 0.28f, 1f));
            DrawRect(texture, 13, 16, 10, 4, new Color(0.6f, 0.44f, 0.34f, 1f));
            texture.Apply();
            return texture;
        }

        private static Texture2D CreatePineTexture()
        {
            Texture2D texture = NewTexture("PrototypePineTexture", 30, 44, TextureWrapMode.Clamp);
            Fill(texture, new Color(0f, 0f, 0f, 0f));
            DrawRect(texture, 13, 4, 4, 14, new Color(0.22f, 0.13f, 0.08f, 1f));
            DrawTriangle(texture, 15, 40, 13, new Color(0.12f, 0.28f, 0.18f, 1f));
            DrawTriangle(texture, 15, 31, 11, new Color(0.16f, 0.36f, 0.22f, 1f));
            DrawTriangle(texture, 15, 23, 9, new Color(0.18f, 0.42f, 0.24f, 1f));
            texture.Apply();
            return texture;
        }

        private static Texture2D CreateGuardrailTexture()
        {
            Texture2D texture = NewTexture("PrototypeGuardrailTexture", 48, 20, TextureWrapMode.Clamp);
            Fill(texture, new Color(0f, 0f, 0f, 0f));
            DrawRect(texture, 2, 11, 44, 4, new Color(0.82f, 0.76f, 0.62f, 1f));
            DrawRect(texture, 6, 4, 4, 10, new Color(0.42f, 0.36f, 0.3f, 1f));
            DrawRect(texture, 28, 4, 4, 10, new Color(0.42f, 0.36f, 0.3f, 1f));
            texture.Apply();
            return texture;
        }

        private static Texture2D CreateSignTexture()
        {
            Texture2D texture = NewTexture("PrototypeSignTexture", 32, 38, TextureWrapMode.Clamp);
            Fill(texture, new Color(0f, 0f, 0f, 0f));
            DrawRect(texture, 14, 3, 4, 18, new Color(0.34f, 0.24f, 0.16f, 1f));
            DrawRect(texture, 5, 19, 22, 13, new Color(0.96f, 0.78f, 0.32f, 1f));
            DrawRect(texture, 7, 21, 18, 2, new Color(0.24f, 0.18f, 0.16f, 1f));
            texture.Apply();
            return texture;
        }

        private static Texture2D CreateHazeTexture()
        {
            Texture2D texture = NewTexture("PrototypeHazeTexture", 16, 16, TextureWrapMode.Repeat);
            Fill(texture, new Color(1f, 0.82f, 0.54f, 0.22f));
            texture.Apply();
            return texture;
        }

        private static Texture2D CreateRainTexture()
        {
            Texture2D texture = NewTexture("PrototypeRainTexture", 64, 64, TextureWrapMode.Repeat);
            Fill(texture, new Color(0f, 0f, 0f, 0f));

            for (int i = 0; i < 18; i++)
            {
                int x = (i * 19) % texture.width;
                int y = (i * 31) % texture.height;
                DrawDiagonal(texture, x, y, 9, new Color(0.76f, 0.88f, 1f, 0.8f));
            }

            texture.Apply();
            return texture;
        }

        private static Texture2D CreateFogTexture()
        {
            Texture2D texture = NewTexture("PrototypeFogTexture", 64, 32, TextureWrapMode.Repeat);

            for (int y = 0; y < texture.height; y++)
            {
                float alpha = Mathf.Clamp01(1f - Mathf.Abs(y - 13f) / 16f) * 0.4f;

                for (int x = 0; x < texture.width; x++)
                {
                    texture.SetPixel(x, y, new Color(0.95f, 0.9f, 0.78f, alpha));
                }
            }

            texture.Apply();
            return texture;
        }

        private static Texture2D NewTexture(string textureName, int width, int height, TextureWrapMode wrapMode)
        {
            Texture2D texture = new Texture2D(width, height, TextureFormat.RGBA32, false)
            {
                name = textureName,
                filterMode = FilterMode.Point,
                wrapMode = wrapMode
            };
            ApplyHideFlags(texture);
            return texture;
        }

        private static void Fill(Texture2D texture, Color color)
        {
            for (int y = 0; y < texture.height; y++)
            {
                for (int x = 0; x < texture.width; x++)
                {
                    texture.SetPixel(x, y, color);
                }
            }
        }

        private static void DrawRect(Texture2D texture, int x, int y, int width, int height, Color color)
        {
            for (int iy = y; iy < y + height; iy++)
            {
                for (int ix = x; ix < x + width; ix++)
                {
                    SetPixelSafe(texture, ix, iy, color);
                }
            }
        }

        private static void DrawTriangle(Texture2D texture, int centerX, int topY, int halfWidth, Color color)
        {
            for (int row = 0; row < halfWidth; row++)
            {
                int y = topY - row;
                int width = Mathf.CeilToInt(row * 0.8f);

                for (int x = centerX - width; x <= centerX + width; x++)
                {
                    SetPixelSafe(texture, x, y, color);
                }
            }
        }

        private static void DrawDiagonal(Texture2D texture, int startX, int startY, int length, Color color)
        {
            for (int i = 0; i < length; i++)
            {
                int x = (startX + i) % texture.width;
                int y = (startY - i + texture.height) % texture.height;
                texture.SetPixel(x, y, color);
            }
        }

        private static void SetPixelSafe(Texture2D texture, int x, int y, Color color)
        {
            if (x < 0 || x >= texture.width || y < 0 || y >= texture.height)
            {
                return;
            }

            texture.SetPixel(x, y, color);
        }
    }
}
