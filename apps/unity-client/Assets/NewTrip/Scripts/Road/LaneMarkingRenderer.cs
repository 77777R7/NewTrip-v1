using UnityEngine;

namespace NewTrip.Client.Road
{
    [ExecuteAlways]
    [RequireComponent(typeof(MeshFilter), typeof(MeshRenderer))]
    public sealed class LaneMarkingRenderer : MonoBehaviour
    {
        private static readonly int MainTexSt = Shader.PropertyToID("_MainTex_ST");

        public Pseudo3DRoadRenderer roadRenderer;

        [Range(8, 96)]
        public int sliceCount = 48;

        [Range(0.002f, 0.08f)]
        public float laneHalfWidthViewport = 0.012f;

        public float textureRepeat = 12f;
        public float scrollMultiplier = 1.6f;
        public bool animateInEditMode;

        private MeshFilter meshFilter;
        private MeshRenderer meshRenderer;
        private Mesh laneMesh;
        private MaterialPropertyBlock propertyBlock;
        private float uvScroll;

        private void Awake()
        {
            EnsureComponents();
            RebuildMesh();
        }

        private void OnEnable()
        {
            EnsureComponents();
            RebuildMesh();
        }

        private void OnValidate()
        {
            sliceCount = Mathf.Max(8, sliceCount);
            EnsureComponents();
            RebuildMesh();
        }

        private void LateUpdate()
        {
            if (roadRenderer == null)
            {
                return;
            }

            if (!Application.isPlaying && !animateInEditMode)
            {
                return;
            }

            uvScroll = Mathf.Repeat(uvScroll + roadRenderer.VisualSpeed * scrollMultiplier * Time.deltaTime, 1f);
            ApplyTextureScroll();
        }

        public void SetMaterial(Material material)
        {
            EnsureComponents();
            meshRenderer.sharedMaterial = material;
            ApplyTextureScroll();
        }

        public void RebuildMesh()
        {
            EnsureComponents();

            if (roadRenderer == null)
            {
                return;
            }

            int vertexRows = sliceCount + 1;
            Vector3[] vertices = new Vector3[vertexRows * 2];
            Vector2[] uvs = new Vector2[vertices.Length];
            int[] triangles = new int[sliceCount * 12];

            for (int i = 0; i < vertexRows; i++)
            {
                float depth = i / (float)sliceCount;
                RoadProjectionSample sample = roadRenderer.Sample(depth);
                float laneHalfWidth = Mathf.Max(0.01f, roadRenderer.renderWidth * laneHalfWidthViewport);
                int leftIndex = i * 2;
                int rightIndex = leftIndex + 1;

                vertices[leftIndex] = new Vector3(sample.CenterX - laneHalfWidth, sample.Y, -0.02f);
                vertices[rightIndex] = new Vector3(sample.CenterX + laneHalfWidth, sample.Y, -0.02f);

                float v = depth * textureRepeat;
                uvs[leftIndex] = new Vector2(0f, v);
                uvs[rightIndex] = new Vector2(1f, v);
            }

            for (int i = 0; i < sliceCount; i++)
            {
                int tri = i * 12;
                int row = i * 2;
                int next = row + 2;

                triangles[tri] = row;
                triangles[tri + 1] = row + 1;
                triangles[tri + 2] = next;
                triangles[tri + 3] = row + 1;
                triangles[tri + 4] = next + 1;
                triangles[tri + 5] = next;
                triangles[tri + 6] = row;
                triangles[tri + 7] = next;
                triangles[tri + 8] = row + 1;
                triangles[tri + 9] = row + 1;
                triangles[tri + 10] = next;
                triangles[tri + 11] = next + 1;
            }

            if (laneMesh == null)
            {
                laneMesh = new Mesh
                {
                    name = "LaneMarkingMesh"
                };
            }
            else
            {
                laneMesh.Clear();
            }

            laneMesh.vertices = vertices;
            laneMesh.uv = uvs;
            laneMesh.triangles = triangles;
            laneMesh.RecalculateBounds();
            laneMesh.RecalculateNormals();

            meshFilter.sharedMesh = laneMesh;
            ApplyTextureScroll();
        }

        private void EnsureComponents()
        {
            if (meshFilter == null)
            {
                meshFilter = GetComponent<MeshFilter>();
            }

            if (meshRenderer == null)
            {
                meshRenderer = GetComponent<MeshRenderer>();
                meshRenderer.sortingOrder = 20;
            }

            if (propertyBlock == null)
            {
                propertyBlock = new MaterialPropertyBlock();
            }
        }

        private void ApplyTextureScroll()
        {
            EnsureComponents();
            meshRenderer.GetPropertyBlock(propertyBlock);
            propertyBlock.SetVector(MainTexSt, new Vector4(1f, 1f, 0f, -uvScroll));
            meshRenderer.SetPropertyBlock(propertyBlock);
        }
    }
}
