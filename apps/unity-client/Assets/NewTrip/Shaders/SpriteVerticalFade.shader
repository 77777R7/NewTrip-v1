Shader "NewTrip/SpriteVerticalFade"
{
    Properties
    {
        _MainTex ("Sprite Texture", 2D) = "white" {}
        _Color ("Tint", Color) = (1,1,1,1)
        _BottomFadeStart ("Bottom Fade Start", Range(0, 1)) = 0.22
        _BottomFadeEnd ("Bottom Fade End", Range(0, 1)) = 0.0
        _TopFadeStart ("Top Fade Start", Range(0, 1)) = 1.0
        _TopFadeEnd ("Top Fade End", Range(0, 1)) = 1.0
    }

    SubShader
    {
        Tags
        {
            "Queue"="Transparent"
            "RenderType"="Transparent"
            "IgnoreProjector"="True"
            "CanUseSpriteAtlas"="True"
        }

        Cull Off
        Lighting Off
        ZWrite Off
        ZTest Always
        Blend SrcAlpha OneMinusSrcAlpha

        Pass
        {
            CGPROGRAM
            #pragma vertex vert
            #pragma fragment frag
            #include "UnityCG.cginc"

            struct appdata
            {
                float4 vertex : POSITION;
                float4 color : COLOR;
                float2 uv : TEXCOORD0;
            };

            struct v2f
            {
                float4 vertex : SV_POSITION;
                fixed4 color : COLOR;
                float2 uv : TEXCOORD0;
            };

            sampler2D _MainTex;
            fixed4 _Color;
            float _BottomFadeStart;
            float _BottomFadeEnd;
            float _TopFadeStart;
            float _TopFadeEnd;

            v2f vert(appdata v)
            {
                v2f o;
                o.vertex = UnityObjectToClipPos(v.vertex);
                o.uv = v.uv;
                o.color = v.color * _Color;
                return o;
            }

            fixed4 frag(v2f i) : SV_Target
            {
                fixed4 col = tex2D(_MainTex, i.uv) * i.color;
                float bottomFade = smoothstep(_BottomFadeEnd, _BottomFadeStart, i.uv.y);
                float topFade = _TopFadeEnd > _TopFadeStart
                    ? 1.0 - smoothstep(_TopFadeStart, _TopFadeEnd, i.uv.y)
                    : 1.0;
                col.a *= bottomFade * topFade;
                return col;
            }
            ENDCG
        }
    }
}
