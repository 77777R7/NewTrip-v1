using System.Collections.Generic;
using UnityEngine;

namespace NewTrip.Client.Road
{
    public sealed class LandmarkSignSpawner : MonoBehaviour
    {
        public Pseudo3DRoadRenderer roadRenderer;
        public Transform signRoot;
        public Sprite placeholderSignSprite;
        public Sprite[] signSprites;
        public Color tint = Color.white;
        public float depthMoveRate = 0.34f;
        public float laneOffset = 0.18f;
        public float nearScale = 1.05f;
        public float farScale = 0.11f;

        [Range(0.2f, 1f)]
        public float spawnDepth = 0.84f;

        private readonly List<SpawnedSign> activeSigns = new List<SpawnedSign>();
        private int signIndex;

        private void Update()
        {
            if (roadRenderer == null)
            {
                return;
            }

            float moveRate = depthMoveRate * Mathf.Max(0.12f, roadRenderer.VisualSpeed);

            for (int i = activeSigns.Count - 1; i >= 0; i--)
            {
                SpawnedSign sign = activeSigns[i];
                sign.Depth -= Time.deltaTime * moveRate;

                if (sign.Depth < -0.08f)
                {
                    DestroyObject(sign.Root.gameObject);
                    activeSigns.RemoveAt(i);
                    continue;
                }

                ApplyProjection(sign);
            }
        }

        public void SpawnPlaceholderSign(RoadsideSide side = RoadsideSide.Right)
        {
            Sprite signSprite = PickNextSignSprite();

            if (signSprite == null)
            {
                return;
            }

            Transform parent = signRoot != null ? signRoot : transform;
            GameObject root = new GameObject("LandmarkSign_VisualOnly");
            root.transform.SetParent(parent, false);

            SpriteRenderer spriteRenderer = root.AddComponent<SpriteRenderer>();
            spriteRenderer.sprite = signSprite;
            spriteRenderer.color = tint;
            spriteRenderer.sortingOrder = 70;

            SpawnedSign sign = new SpawnedSign(root.transform, spriteRenderer, side)
            {
                Depth = spawnDepth
            };

            activeSigns.Add(sign);
            ApplyProjection(sign);
        }

        private Sprite PickNextSignSprite()
        {
            if (signSprites != null && signSprites.Length > 0)
            {
                Sprite sprite = signSprites[signIndex % signSprites.Length];
                signIndex++;
                return sprite != null ? sprite : placeholderSignSprite;
            }

            return placeholderSignSprite;
        }

        private void ApplyProjection(SpawnedSign sign)
        {
            float sideSign = sign.Side == RoadsideSide.Left ? -1f : 1f;
            RoadProjectionSample sample = roadRenderer.Sample(sign.Depth);
            float x = sample.CenterX + sample.HalfWidth * (1f + laneOffset) * sideSign;
            float scale = Mathf.Lerp(nearScale, farScale, Mathf.Clamp01(sign.Depth));

            sign.Root.localPosition = new Vector3(x, sample.Y, -0.06f);
            sign.Root.localScale = Vector3.one * scale;
        }

        private static void DestroyObject(GameObject gameObject)
        {
            if (Application.isPlaying)
            {
                Destroy(gameObject);
            }
            else
            {
                DestroyImmediate(gameObject);
            }
        }

        private sealed class SpawnedSign
        {
            public SpawnedSign(Transform root, SpriteRenderer renderer, RoadsideSide side)
            {
                Root = root;
                Renderer = renderer;
                Side = side;
            }

            public Transform Root { get; }

            public SpriteRenderer Renderer { get; }

            public RoadsideSide Side { get; }

            public float Depth { get; set; }
        }
    }
}
