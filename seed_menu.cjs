const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://ubwkrnmhvfhshvoghjia.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVid2tybm1odmZoc2h2b2doamlhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE2Mjc2ODksImV4cCI6MjA5NzIwMzY4OX0.inYVIGBg2eqyHJhOYGnCUrAW76zTcO0i5RwnqQXaRsw';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

const mockMenuItems = [
  {
    id: "11111111-1111-1111-1111-111111111101",
    name: "Stratizen Signature Salad",
    description: "Mixed greens, cherry tomatoes, quinoa, and grilled chicken with a light vinaigrette.",
    price: 850.00,
    image_url: "https://lh3.googleusercontent.com/aida-public/AB6AXuBDAvAkbHg-xSrm17hiMlaXE-P_KF2uIW_9ORh5qpncFNDE3VojpAAQDORJdlFgrP8xpOEqrf0d01xn_yteB6CN1rNmYQToXINQOKcItIGwJo6Mx7HP9NItcTsVXMd7Vu962FtBKMFgLnZ_SQbU-Xa0ErNwzlbhhngVNFkg2P8LR1Mi-OMWDBdbH5AJMoOveHpxwwTgDiwTM1PVTbVFmdUBETkz1tr1f6duCDcbPD-AjXjAuTzuHJU3ObDQ9LhBQ8bTBHVnvzdVHA",
    category: "Lunch",
    availability: true
  },
  {
    id: "11111111-1111-1111-1111-111111111102",
    name: "Campus Classic Burger",
    description: "Quarter-pound beef patty, cheddar cheese, lettuce, tomato, and house sauce.",
    price: 1025.00,
    image_url: "https://lh3.googleusercontent.com/aida-public/AB6AXuCwv0t6f41yXzXzAdO71wX_BuU4w85XRcx5Z86euvNqqSeHi7jelbKQcS2942SXbdJGDb_98Ce_JjymEy9YuFu10hVO2pnW5RnXhlh0cM0JqapRGF_-fEh9FF3eZun_KOKEnCLDeQ0Qn73-SkROH1tEL3Jc38dOtfF2Rr2C1lMND9TqynF1H9Ua9In1J5Ck67UI_Nc8c-IdJ_uh-3EjRR0Bn-ZnQ0WLlFYY_gkhbiYKP11VjySTYhFuP_zDQyeD-pQxW1GaaC13nw",
    category: "Lunch",
    availability: true
  },
  {
    id: "11111111-1111-1111-1111-111111111103",
    name: "Library Late-Night Pizza",
    description: "Personal 10\" pizza with rich tomato sauce, fresh mozzarella, and basil.",
    price: 1200.00,
    image_url: "https://lh3.googleusercontent.com/aida-public/AB6AXuBuYsvhLtKg-6BhMR6d8r-KifN_4BxQRwWg1ws14pyExct8osdi-UUE7luxHco35hG2NkuDFpfMCuoZSZ9kCr4HrDVPRCBQIjwh8YHH-N_pfanuKi9qloda8yH0GTauKNMNx41ihTonfYkRkC7MVdb2EZ1XzwttXZmPYnm-tJ80OA_5Yl4rcWfuV2vFighF76cLR-iQczw_wrkXigLcdfhDEotkDbc9jtR5iIpGtOB2Uz38KAWPkKzGzgQQdDNEk2iF2HUaQhZN7A",
    category: "Dinner",
    availability: true
  },
  {
    id: "11111111-1111-1111-1111-111111111104",
    name: "Study Session Cold Breve Brew",
    description: "Slow-steeped cold brew coffee over ice. Optional milk or flavor shots available.",
    price: 450.00,
    image_url: "https://lh3.googleusercontent.com/aida-public/AB6AXuC-S_ObhL60EFysowjOV49loMMz4wrwb3NnkyuTAKToruq4qA5m_soP9gYJ8VGYgX70AoyK83ZozirM0bQp-byz0_GDNls0rvp4X1u6to6CHKhxU2KEF7Of8iPJhRksfAA-CpGZ4G0TmNmv54ekhsDRjbNKHp2sEj5-Z_FGkJpzeV7b2lfc8rrbFbxyhlodFGQ9qUALY6OYiWmdFddhkN6emeW2TgdV4F_PwG-e_sd1pI-sNntsAfoYIcFwlrtA4SxjcMbFQnOTQQ",
    category: "Beverages",
    availability: true
  },
  {
    id: "11111111-1111-1111-1111-111111111105",
    name: "Savory Breakfast Burrito",
    description: "Scrambled eggs, chorizo, black beans, and avocado wrapped in a warm flour tortilla.",
    price: 650.00,
    image_url: "https://lh3.googleusercontent.com/aida-public/AB6AXuAPJvyez_vztQW_U4_vs9jzCIYQDYydioXjZJSyO6P6PWtJKl_9ay9o5G3Nfmcc7KmKFNsTCFmIQeJgKpVud6zgpmTottr0VCje3SFUU6BCXiTx3-1O_8hZD2FsGvvPi1w-3OvwSmd3JWxM0eMWMBQhX1TVrGGusiUokfT9hR6Zj_8SQUNaIuWPNvyI3zCdPNQ5U1kwdrmiYAyAMZpi_2eiTYdAKxbk4WYX6E0d6ANL2YCoYf0GTEo1s8p7AwNgo3axuWbABXE6fA",
    category: "Breakfast",
    availability: true
  },
  {
    id: "11111111-1111-1111-1111-111111111106",
    name: "Fresh Fruit Medley",
    description: "A seasonal selection of fresh berries, melon, and citrus fruits.",
    price: 400.00,
    image_url: "https://lh3.googleusercontent.com/aida-public/AB6AXuBe7DOjQo22SE5XWRKOjPREv3RGVOw9a1TdW781XwFCPCzqVNKsFKmsNLoGk538PvCUkm9pf_xT_KGdH7y_NSpQ1Uvm5gxrqJv8-iabSN7Qm58bjerQgie90Ime-GfLNtiHHPHicVNsa4UP75eUsRMpr8aW8oNJkKxwHKLWWrNwlMZbEr1ZSW-LehPvqmzHzqCH_frwoy_VflhbNqmsujvqcc2WXy3qrgz_2FNwe39q6APPqVZ00WPc23Trb96OsdHYA4dOHVBmtw",
    category: "Sides",
    availability: true
  },
  {
    id: "11111111-1111-1111-1111-111111111107",
    name: "Grilled Salmon Fillet",
    description: "Atlantic salmon grilled with lemon and herbs, served with roasted asparagus.",
    price: 1450.00,
    image_url: "https://lh3.googleusercontent.com/aida-public/AB6AXuC29Il2h63fr9InUuM4WH0EnjXKTTHaaxhVxo42x8DedTtmxB29oKTdlxB_SOQk119ioIRdUPERVvi9VuQ6xXdCHc75MuB2RTVFO_a6XmaJXd8vMKzEms8Dk1_jD5ieEyyBzGMhVKeMzSAddiSl51gbPnmEASnqLtybgmEK1xDfobdSNBLpKYBTsjanC3etJ0Nm9U7WNGHfCH0wyNfkEH-28CEgsYiNoCEl50Jtd-w4efCoT5retgKgIAoX9R5Zbrd207oQD_hElg",
    category: "Lunch",
    availability: true
  },
  {
    id: "11111111-1111-1111-1111-111111111108",
    name: "Mushroom Risotto",
    description: "Creamy Arborio rice with wild mushrooms, parmesan, and truffle oil.",
    price: 1100.00,
    image_url: "https://lh3.googleusercontent.com/aida-public/AB6AXuBD6Seyl-RVOx_TJo_6eeAa2i_0thMe01R82JPulcKMzEiG8YIVVX3lr7nha_bV-49bUgO3WGfj1cb5mzyPECcDPtDxn64PLXhC5_frZsTMqM5vk6Yu76TMgu7Y5wkHswXHhparR_DcTy4b1AsMdi49BRrbppuiu0jpyq5O_IBbmB9UWihe9RazAEy7uf39JCafJ7ebzk9Db9NGLHgTYpeHTNJlpLmcb9i8McNJfOjSCOC_-Zui5fxj3Cv-7MyCA2Re3wZgDpnHMw",
    category: "Dinner",
    availability: true
  },
  {
    id: "11111111-1111-1111-1111-111111111109",
    name: "Tropical Fruit Smoothie",
    description: "A refreshing blend of mango, pineapple, and coconut milk.",
    price: 550.00,
    image_url: "https://lh3.googleusercontent.com/aida-public/AB6AXuDCvqsyACbyZXKcoAsO8WJy1-vU7mGE4DOSkuWjxwTMQjxOLu1SrJzblhx-23V5xaCFMhMN8DwzlTJuXoRce2ztTjTY_VqiNfUmKnZJRitNKdWa02WpRZX5I-vDwcBTWITcq_VZ443U-LBFgPLnEaUvY6LIRsDXtJpLsxha8UgydnjqZ8InAEePtTts24E9vdAHiq4BJl8MdbsPon9KFP3dI5p7lVVj3S6WcUJNjhQqmhVyXpXQ6_UI8MplPsLG2yhWFjEN6vEG8w",
    category: "Beverages",
    availability: true
  },
  {
    id: "11111111-1111-1111-1111-111111111110",
    name: "Classic Caesar Salad",
    description: "Crisp romaine lettuce, garlic croutons, and parmesan with Caesar dressing.",
    price: 800.00,
    image_url: "https://lh3.googleusercontent.com/aida-public/AB6AXuBkTGQC-QugLfmcAQ-Xnb38jAD-a8kx7wKqXmLMRlSoRMPt2Aqop2FI1xJat-a3F0ZAwrrYNLdHAk6OdvYxuKmVfSIVvYdQw4AzhKG0x_aBIkqqTNdHTw4OWWAyK3c1-qOXVnuMhlGi8DYNZXq2B-xFwRtcyoQfUNVx_M2rNfOEPsrWUyJAFWe7KhdmzdpnNgm52BVry4rfeEKbWILBG6l9VHDysgetJvDQszQC37rG1osID8TyWeS3kmy4Qh3vjZbzC7Zn7Eghyg",
    category: "Lunch",
    availability: true
  },
  {
    id: "11111111-1111-1111-1111-111111111111",
    name: "Gourmet Beef Sliders",
    description: "Three mini beef burgers with caramelized onions and blue cheese.",
    price: 975.00,
    image_url: "https://lh3.googleusercontent.com/aida-public/AB6AXuAcDgHNXCTGdl2O5T_mNFRJyu6lyY6RhAj1RO9KeG5naeINGY73GENwiVmrqJFS40I4uN3DlWmvZAee0NyTKdPf7iJGV0tylg-ewFp-rBTku6Hgn9Frzl-ls8KxMrTzflfxF1vf6QvUsh9svfsFPxyExXyWpxgrfsUajqlcxBj2XKqRXIFVlZM-ZhVSRDa34Vs8BG5ZlDwyMg1quMkWraBqpbmxWI17b4tCTXJCJfyEoaGt_gMTIrNp7x0aIsVmEgn-T13lMHuThA",
    category: "Dinner",
    availability: true
  },
  {
    id: "11111111-1111-1111-1111-111111111112",
    name: "Artisan Cheese Plate",
    description: "A curated selection of local cheeses, honey, and toasted nuts.",
    price: 1325.00,
    image_url: "https://lh3.googleusercontent.com/aida-public/AB6AXuDLCf7i_zvWmsUsxPQ7l3n4-n6lq8YYIIFOeTLWfklWrrY0VYsWUxl9SR25qyb2lxXIbQxJDLQIvKYFReTQSwR3iXAvtNaWaPm-t-3b21UqwreqHkW8N1VNvoKLSl8dAflmQM3d2g5X2BRbKj-zVEzG12bNuuXPROD91ly0Hpj5hGFMnBr56famZkPRoWmrqn-0jts6pGimjPKPVcu6C4T40nKHMkpkb6IQsh9u1QZMGbEQICxCNzhQ6jDZ2WrO4_PoYMh8_xkbHg",
    category: "Sides",
    availability: true
  },
  {
    id: "11111111-1111-1111-1111-111111111113",
    name: "Quinoa Power Bowl",
    description: "Roasted sweet potatoes, avocado slices, and edamame beans on a bed of brown rice.",
    price: 925.00,
    image_url: "https://lh3.googleusercontent.com/aida-public/AB6AXuBSL0BgPz6wRVsbpjcKvpdFnDX9QtU7-hLaq61ZACd6yKShwJJNyfVJ7onILCm4f-btuYiHKViaygE67TkzYTa6CodqcZU3XEzJKDFER-AC_SrjOx-Er3AVXuN4TWKtlW_CSIhA9ApeLGR1trmltYaAC-AlqxA3SJZC9AeDI_DO7Sr20y2jF2WVDF_PuusvkV2p5vRhv0qetXHB3cnu9TUAim7ebBaRbi6x2TIPjdkCQcef0bjdRO7ceu3hZ-lI3T4yr-I2fIgM9w",
    category: "Lunch",
    availability: true
  },
  {
    id: "11111111-1111-1111-1111-111111111114",
    name: "Chicken Pesto Wrap",
    description: "Grilled chicken wrap with fresh spinach, roasted peppers, creamy feta, and pesto.",
    price: 795.00,
    image_url: "https://lh3.googleusercontent.com/aida-public/AB6AXuAWDq3L_d40yeUgHgXkS8U8Qr9OejhzbVuburfF46j785eEsEISH68BkcirQ-mqbdoHdLyAMo4yDuHmRCHmBXgrVzv1RLf3kK9NH9WNJHHA2UEfYZK3I7VCXNuhHzluKmKyE0bLnoiR4W4-RYNGnpOQ1zQj_L6s7wnROxzY3psgZpoRNnYavLyrg-dvHNreD59OoRe_V3VQaWfTonPz-XeVcbm8cImMpwDFiJJAa6p1VcObfrr7DC22iW13evq8V9AhIclofSu3pQ",
    category: "Lunch",
    availability: true
  },
  {
    id: "11111111-1111-1111-1111-111111111115",
    name: "Lentil Soup",
    description: "Mediterranean lentil soup garnished with olive oil, served with crusty bread.",
    price: 550.00,
    image_url: "https://lh3.googleusercontent.com/aida-public/AB6AXuAExJdr5lQn94GGgvgD79J6KqohZVOMZmy5SJBm8tswEifLV7jIHhvcWihUfBqeOV2hSIOlQ9pqSGbQ0a4dzSvj1BFYU_gsQMClfZqyiQLU-t2Y4hzU4-3Jn9KjFmnWPlTxormI_d6pPXjOo-FwqE6oR_EOOI1aJ1npIvdb9_PAVbxn-9yxvnXkTYwd1x7ypR2SEcVhO0f1XqLCv1ySh7S4keBIfbGgQXSCrrgg2iRi5NpuzJFM5gVzEYHTun_QFW7ach7ezpJ9MQ",
    category: "Lunch",
    availability: true
  },
  {
    id: "11111111-1111-1111-1111-111111111116",
    name: "Classic Greek Salad",
    description: "Cucumbers, tomatoes, kalamata olives, red onions, and chunks of feta cheese.",
    price: 800.00,
    image_url: "https://lh3.googleusercontent.com/aida-public/AB6AXuActpBGSQfwJ9UeEDAFw5D1BA7pB8wJuUGvfdFNNhBHb8lGxA5zkWKF_wvp0jnsk3p1UoUO9jMrkw45kafohpMAkBRZwbAOAjhP4y6Qf0qb78dvnFGCw-NTnWUDKAZZI4umbv-iob-DPFBoXI9irTMDEb5IvOKpAMydSoQv3_2VIxtQ4fgThUQGra7KOwYjojJcPtM8OBb4IWmm6zVH_HL2V5o_c0ooAxAFR7r2sFS55GiiIvSMkeX3wUOFZyAgeqO7KEY8etCelw",
    category: "Lunch",
    availability: true
  }
];

async function seed() {
  console.log('Seeding menu...');
  
  // 1. Authenticate as chef first to bypass RLS
  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email: 'chef1@gmail.com',
    password: '12345678'
  });

  if (authError) {
    console.error('Failed to authenticate as chef for seeding:', authError.message);
    return;
  }

  console.log('Authenticated as chef. Seeding menu items...');

  // 2. Perform the menu upsert
  const { data, error } = await supabase.from('menu').upsert(mockMenuItems);
  if (error) {
    console.error('Error seeding menu:', error);
  } else {
    console.log('Menu seeded successfully!');
  }
}

seed();
