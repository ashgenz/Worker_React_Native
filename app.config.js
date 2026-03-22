export default ({ config }) => {
  return {
    ...config,
    extra: {
      BASE_URL: process.env.BASE_URL || "http://192.168.0.169:5000",
      ROUTER_IP: process.env.ROUTER_IP || "192.168.0.169",
      PORT_BOOKINGS: process.env.PORT_BOOKINGS || "5000",
      eas: {
        projectId: "94a0082a-9ec3-4494-a1c8-181b7a2e2b82"
      }
    },
  };
};